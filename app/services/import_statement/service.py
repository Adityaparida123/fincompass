"""Bank statement import orchestration.

``analyze_statement_file`` parses/uploads to a reviewable preview without
writing anything. ``confirm_statement_import`` persists only the rows the user
explicitly confirmed, re-checking duplicates at write time.
"""

from __future__ import annotations

import asyncio
import os
import tempfile

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import InvalidInputError
from app.db.enums import TransactionSource, TransactionType
from app.db.mongo import Doc, MongoDatabase
from app.schemas.import_statement import (
    StatementAnalyzeResponse,
    StatementConfirmItem,
    StatementConfirmResponse,
    StatementPreviewTransaction,
)
from app.services.import_statement.categorize import categorize_row
from app.services.import_statement.dedupe import (
    fingerprint,
    load_existing_fingerprints,
    mark_duplicates,
)
from app.services.import_statement.parsers import detect_format, parse_file


async def _save_temporarily(content: bytes, fmt: str) -> str:
    fd, path = tempfile.mkstemp(prefix="stmt_", suffix=f".{fmt}")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(content)
    except Exception:
        os.unlink(path)
        raise
    return path


def _cleanup(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass


async def analyze_statement_file(
    db: MongoDatabase,
    user_id: int,
    upload: UploadFile,
) -> StatementAnalyzeResponse:
    content = await upload.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise InvalidInputError(
            f"File is too large (max {settings.MAX_UPLOAD_SIZE // (1024 * 1024)} MB)."
        )
    if not content:
        raise InvalidInputError("The uploaded file is empty.")

    fmt = detect_format(upload.filename or "", content[:4096])
    path = await _save_temporarily(content, fmt)
    try:
        raw_rows = await asyncio.to_thread(parse_file, path, fmt)
    finally:
        _cleanup(path)

    if not raw_rows:
        raise InvalidInputError(
            "No transactions could be read from this statement. "
            "The file may be empty, or the format is not recognised."
        )

    categorized = await asyncio.gather(
        *[
            categorize_row(row.description, row.amount, row.transaction_type)
            for row in raw_rows
        ]
    )

    existing = await load_existing_fingerprints(db, user_id)

    preview = []
    for idx, (row, cat) in enumerate(zip(raw_rows, categorized, strict=True)):
        preview.append(
            StatementPreviewTransaction(
                row_number=idx + 1,
                date=row.date,
                description=row.description,
                amount=abs(row.amount),
                transaction_type=TransactionType(row.transaction_type),
                category=cat.category,
                confidence=cat.confidence,
                confidence_label=cat.confidence_label,
                needs_review=cat.needs_review,
                category_source=cat.source,
                is_duplicate=False,
                reference=row.reference,
            )
        )

    preview, duplicate_count = mark_duplicates(preview, existing, user_id)
    expenses = sum(1 for t in preview if t.transaction_type == TransactionType.expense)
    income = sum(1 for t in preview if t.transaction_type == TransactionType.income)
    needs_review = sum(1 for t in preview if t.needs_review)
    skipped = len(raw_rows) - len(preview)

    message = None
    if duplicate_count:
        message = f"{duplicate_count} possible duplicate transaction(s) detected."

    return StatementAnalyzeResponse(
        file_name=upload.filename or "statement",
        total_rows=len(preview),
        expenses_count=expenses,
        income_count=income,
        duplicate_count=duplicate_count,
        needs_review_count=needs_review,
        skipped_rows=skipped,
        transactions=preview,
        message=message,
    )


async def confirm_statement_import(
    db: MongoDatabase,
    user_id: int,
    items: list[StatementConfirmItem],
) -> StatementConfirmResponse:
    existing = await load_existing_fingerprints(db, user_id)

    seen: set[str] = set()
    to_insert: list[dict] = []
    duplicates_skipped = 0

    for item in items:
        fp = fingerprint(
            user_id,
            item.date,
            item.amount,
            item.description,
            item.transaction_type.value,
        )
        if fp in existing or fp in seen:
            duplicates_skipped += 1
            continue
        seen.add(fp)
        to_insert.append(
            {
                "user_id": user_id,
                "date": item.date,
                "description": item.description,
                "amount": item.amount,
                "currency": settings.DEFAULT_CURRENCY,
                "transaction_type": item.transaction_type.value,
                "category": item.category,
                "subcategory": item.subcategory,
                "source": TransactionSource.import_.value,
                "is_deleted": False,
            }
        )

    inserted: list[Doc] = []
    for doc in to_insert:
        inserted.append(await db.insert("transactions", doc))

    if inserted:
        from app.core.cache import invalidate_user_financial_cache

        await invalidate_user_financial_cache(user_id)

    return StatementConfirmResponse(
        imported_count=len(inserted),
        duplicates_skipped=duplicates_skipped,
    )
