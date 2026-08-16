"""Duplicate detection for imported statement rows.

Duplicate statuses (spec: 12):

    "new"                 no match
    "possible_duplicate"  fuzzy match (same day+amount with different
                          narration, or same merchant/description+amount
                          within a few days)
    "duplicate"           exact fingerprint match

The fingerprint combines date, absolute amount, normalized description and
transaction type (plus the reference/UTR when present). Rows are checked
against the user's existing transactions and against the statement itself so
re-importing the same statement never silently double-counts.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from app.db.mongo import Doc, MongoDatabase
from app.services.import_statement.normalize import parse_date

_FUZZY_DATE_WINDOW_DAYS = 3


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


def _amount_str(amount: Decimal) -> str:
    return f"{abs(amount):.2f}"


def fingerprint(
    user_id: int,
    tx_date: date,
    amount: Decimal,
    description: str,
    transaction_type: str,
    reference: str | None = None,
) -> str:
    amount_str = _amount_str(amount)
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


@dataclass
class ExistingIndex:
    """Fingerprint set plus fuzzy-match indexes over known transactions."""

    exact: set[str] = field(default_factory=set)
    by_date_amount: dict[tuple[str, str], set[str]] = field(default_factory=dict)
    by_desc_amount: dict[tuple[str, str], set[str]] = field(default_factory=dict)

    def add(self, tx_date: date, amount: Decimal, description: str) -> None:
        date_key = _coerce_date(tx_date).isoformat()
        desc = normalize_description_for_match(description)
        amount_key = _amount_str(amount)
        self.by_date_amount.setdefault((date_key, amount_key), set()).add(desc)
        self.by_desc_amount.setdefault((desc, amount_key), set()).add(date_key)

    def is_possible(self, tx_date: date, amount: Decimal, description: str) -> bool:
        """Fuzzy match: same day+amount (different narration) or same
        narration+amount within a small date window."""
        date_key = _coerce_date(tx_date).isoformat()
        desc = normalize_description_for_match(description)
        amount_key = _amount_str(amount)

        same_day = self.by_date_amount.get((date_key, amount_key))
        if same_day and desc not in same_day:
            return True

        day = date.fromisoformat(date_key)
        dates = self.by_desc_amount.get((desc, amount_key))
        if dates:
            for existing in dates:
                if abs(day - date.fromisoformat(existing)).days <= _FUZZY_DATE_WINDOW_DAYS:
                    return True
        return False


@dataclass
class ExistingRecord:
    date: date
    amount: Decimal
    description: str
    transaction_type: str
    reference: str | None = None


async def load_existing_fingerprints(db: MongoDatabase, user_id: int) -> set[str]:
    """Fingerprints of all non-deleted transactions belonging to the user."""
    return (await load_existing_index(db, user_id)).exact


async def load_existing_index(db: MongoDatabase, user_id: int) -> ExistingIndex:
    """Index over the user's existing transactions for exact + fuzzy matching."""
    rows: list[Doc] = await db.find(
        "transactions",
        {"user_id": user_id, "is_deleted": False},
    )
    index = ExistingIndex()
    for row in rows:
        try:
            tx_date = _coerce_date(row.date)
            amount = Decimal(row.amount)
            desc = row.description
            index.exact.add(
                fingerprint(
                    user_id,
                    tx_date,
                    amount,
                    desc,
                    row.transaction_type,
                    getattr(row, "reference", None),
                )
            )
            index.add(tx_date, amount, desc)
        except (ValueError, TypeError, ArithmeticError):
            continue
    return index


def mark_duplicates(rows: list, existing: ExistingIndex | set[str], user_id: int) -> tuple[list, int]:
    """Set ``duplicate_status``/``is_duplicate`` on each preview row.

    Returns ``(rows, duplicate_count)`` where ``duplicate_count`` counts exact
    duplicates; possible matches are flagged but remain selectable.
    """
    if isinstance(existing, set):
        existing = ExistingIndex(exact=existing)

    seen_exact: set[str] = set()
    statement_index = ExistingIndex()
    duplicate_count = 0

    for item in rows:
        fp = fingerprint(
            user_id,
            item.date,
            item.amount,
            item.description,
            getattr(item.transaction_type, "value", item.transaction_type),
            item.reference,
        )
        if fp in existing.exact or fp in seen_exact:
            item.duplicate_status = "duplicate"
            item.is_duplicate = True
            duplicate_count += 1
        elif existing.is_possible(item.date, item.amount, item.description) or statement_index.is_possible(
            item.date, item.amount, item.description
        ):
            item.duplicate_status = "possible_duplicate"
            item.is_duplicate = False
        else:
            item.duplicate_status = "new"
            item.is_duplicate = False
        seen_exact.add(fp)
        statement_index.add(item.date, item.amount, item.description)

    return rows, duplicate_count
