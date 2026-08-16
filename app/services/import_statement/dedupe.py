"""Duplicate detection for imported statement rows.

A fingerprint combines date, absolute amount, normalized description and
transaction type (plus the reference/UTR when present). Rows are checked
against the user's existing transactions and against the statement itself so
re-importing the same statement never silently double-counts.
"""

from __future__ import annotations

import hashlib
import re
from datetime import date
from decimal import Decimal

from app.db.mongo import Doc, MongoDatabase
from app.services.import_statement.normalize import parse_date


def _coerce_date(value) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        parsed = parse_date(value) or parse_date(value[:10])
        if parsed is not None:
            return parsed
    raise ValueError(f"Unparseable transaction date: {value!r}")


def normalize_description_for_match(description: str) -> str:
    text = (description or "").strip().lower()
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def fingerprint(
    user_id: int,
    tx_date: date,
    amount: Decimal,
    description: str,
    transaction_type: str,
    reference: str | None = None,
) -> str:
    amount_str = f"{abs(amount):.2f}"
    parts = [
        str(user_id),
        _coerce_date(tx_date).isoformat(),
        amount_str,
        normalize_description_for_match(description),
        transaction_type,
    ]
    if reference:
        parts.append(normalize_description_for_match(reference))
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def load_existing_fingerprints(db: MongoDatabase, user_id: int) -> set[str]:
    """Fingerprints of all non-deleted transactions belonging to the user."""
    rows: list[Doc] = await db.find(
        "transactions",
        {"user_id": user_id, "is_deleted": False},
    )
    fingerprints: set[str] = set()
    for row in rows:
        try:
            fingerprints.add(
                fingerprint(
                    user_id,
                    _coerce_date(row.date),
                    Decimal(row.amount),
                    row.description,
                    row.transaction_type,
                    getattr(row, "reference", None),
                )
            )
        except (ValueError, TypeError, ArithmeticError):
            continue
    return fingerprints


def mark_duplicates(rows: list[tuple], existing: set[str], user_id: int) -> tuple[list[tuple], int]:
    """Mark in-statement duplicates; return (rows, duplicate_count)."""
    seen = set()
    count = 0
    for item in rows:
        fp = fingerprint(user_id, item.date, item.amount, item.description, item.transaction_type, item.reference)
        if fp in existing or fp in seen:
            count += 1
            item.is_duplicate = True
        seen.add(fp)
    return rows, count
