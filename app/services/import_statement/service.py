"""Bank statement import orchestration.

``analyze_statement_file`` runs the full pipeline — validation, format
detection, parsing, normalization, classification, merchant extraction,
movement classification, categorization, duplicate detection, confidence
scoring, validation, recurring detection — and returns a reviewable preview
without writing anything. ``confirm_statement_import`` persists only the rows
the user explicitly confirmed, re-checking duplicates at write time and
inserting them in bulk.

Nothing about the statement contents (descriptions, amounts, balances) is ever
logged; only aggregate metrics (see ``metrics.py``).
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
    load_existing_index,
    mark_duplicates,
)
from app.services.import_statement.merchant import extract_merchant
from app.services.import_statement.metrics import ImportTimings, log_import_metrics
from app.services.import_statement.movement import classify_movement
from app.services.import_statement.parsers import detect_format, parse_file
from app.services.import_statement.recurring import detect_recurring
from app.services.import_statement.validate import validate_row
from app.services.notifications import notify


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
    timings = ImportTimings()

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

    existing = await load_existing_index(db, user_id)

    preview: list[StatementPreviewTransaction] = []
    for idx, (row, cat) in enumerate(zip(raw_rows, categorized, strict=True)):
        merchant = extract_merchant(row.description)
        movement_type, movement_review = classify_movement(
            row.description, row.transaction_type, cat.category
        )
        warnings = validate_row(
            tx_date=row.date, amount=abs(row.amount), description=row.description
        )
        preview.append(
            StatementPreviewTransaction(
                row_number=idx + 1,
                date=row.date,
                description=row.description,
                amount=abs(row.amount),
                transaction_type=TransactionType(row.transaction_type),
                category=cat.category,
                subcategory=cat.subcategory,
                merchant=merchant,
                movement_type=movement_type,
                confidence=cat.confidence,
                confidence_label=cat.confidence_label,
                needs_review=cat.needs_review or movement_review or bool(warnings),
                category_source=cat.source,
                duplicate_status="new",
                is_duplicate=False,
                recurring=False,
                warnings=warnings,
                reference=row.reference,
            )
        )

    preview, duplicate_count = mark_duplicates(preview, existing, user_id)

    recurring_rows = detect_recurring(preview)
    for item in preview:
        if item.row_number in recurring_rows:
            item.recurring = True

    new_count = sum(1 for t in preview if t.duplicate_status == "new")
    possible_duplicate_count = sum(
        1 for t in preview if t.duplicate_status == "possible_duplicate"
    )
    expenses = sum(1 for t in preview if t.transaction_type == TransactionType.expense)
    income = sum(1 for t in preview if t.transaction_type == TransactionType.income)
    needs_review = sum(1 for t in preview if t.needs_review)
    recurring_count = sum(1 for t in preview if t.recurring)
    skipped = len(raw_rows) - len(preview)

    messages: list[str] = []
    if duplicate_count:
        messages.append(f"{duplicate_count} duplicate transaction(s) already exist and are unchecked.")
    if possible_duplicate_count:
        messages.append(f"{possible_duplicate_count} possible duplicate(s) need a quick look.")
    if needs_review:
        messages.append(f"{needs_review} transaction(s) are flagged for review.")

    log_import_metrics(
        file_type=fmt,
        elapsed_ms=timings.elapsed_ms(),
        rows_extracted=len(raw_rows),
        valid_rows=len(preview),
        duplicates=duplicate_count,
        possible_duplicates=possible_duplicate_count,
        needs_review=needs_review,
    )

    return StatementAnalyzeResponse(
        file_name=upload.filename or "statement",
        total_rows=len(preview),
        new_count=new_count,
        expenses_count=expenses,
        income_count=income,
        duplicate_count=duplicate_count,
        possible_duplicate_count=possible_duplicate_count,
        needs_review_count=needs_review,
        recurring_count=recurring_count,
        skipped_rows=skipped,
        transactions=preview,
        message=" ".join(messages) if messages else None,
    )


async def confirm_statement_import(
    db: MongoDatabase,
    user_id: int,
    items: list[StatementConfirmItem],
) -> StatementConfirmResponse:
    timings = ImportTimings()
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
                "merchant": item.merchant,
                "source": TransactionSource.import_.value,
                "is_deleted": False,
            }
        )

    inserted: list[Doc] = await db.insert_many("transactions", to_insert)

    if inserted:
        from app.core.cache import invalidate_user_financial_cache

        await invalidate_user_financial_cache(user_id)

    log_import_metrics(
        file_type="confirm",
        elapsed_ms=timings.elapsed_ms(),
        rows_extracted=len(items),
        valid_rows=len(to_insert),
        duplicates=duplicates_skipped,
        possible_duplicates=0,
        needs_review=0,
        imported=len(inserted),
        stage="confirm",
    )

    if inserted:
        parts = [f"{len(inserted)} transaction(s) imported successfully"]
        if duplicates_skipped:
            parts.append(f"{duplicates_skipped} duplicate(s) skipped")
        await notify(
            db, user_id,
            title="Statement imported",
            message=f"{'. '.join(parts)}.",
            ntype="import_completed",
        )

    return StatementConfirmResponse(
        imported_count=len(inserted),
        duplicates_skipped=duplicates_skipped,
    )
