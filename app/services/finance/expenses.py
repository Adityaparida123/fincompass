"""Expense analysis helpers (deterministic aggregation).

All monetary arithmetic uses Decimal. Aggregation happens in Python over a
filtered document cursor so results are exact and driver-agnostic.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from pydantic import BaseModel

from app.db.mongo import MongoDatabase
from app.utils.dates import period_key

MONTHLY_REPORT_PERIODS = 6

_TRANSACTION_TYPE = "expense"


async def expense_totals(
    db: MongoDatabase,
    user_id: int,
    start: date,
    end: date,
) -> tuple[Decimal, int]:
    filt = {
        "user_id": user_id,
        "transaction_type": _TRANSACTION_TYPE,
        "is_deleted": False,
        "date": {"$gte": start, "$lt": end},
    }
    rows = await db.find("transactions", filt)
    total = sum((row.amount for row in rows), Decimal("0"))
    return total, len(rows)


async def income_totals(db: MongoDatabase, user_id: int, start: date, end: date) -> Decimal:
    filt = {
        "user_id": user_id,
        "transaction_type": "income",
        "is_deleted": False,
        "date": {"$gte": start, "$lt": end},
    }
    return await db.sum_field("transactions", filt, "amount")


async def category_totals(
    db: MongoDatabase, user_id: int, start: date, end: date
) -> list[tuple[str, Decimal, int]]:
    filt = {
        "user_id": user_id,
        "transaction_type": _TRANSACTION_TYPE,
        "is_deleted": False,
        "date": {"$gte": start, "$lt": end},
    }
    totals: dict[str, Decimal] = {}
    counts: dict[str, int] = {}
    for row in await db.find("transactions", filt):
        category = row.category
        totals[category] = totals.get(category, Decimal("0")) + row.amount
        counts[category] = counts.get(category, 0) + 1
    return [(cat, totals[cat], counts[cat]) for cat in sorted(totals)]


def bucket_rows_by_period(
    rows: list[tuple[date, str, Decimal]], granularity: str
) -> dict[str, Decimal]:
    buckets: dict[str, Decimal] = {}
    for d, _cat, amount in rows:
        key = period_key(d, granularity)
        buckets[key] = buckets.get(key, Decimal("0")) + amount
    return buckets


async def expense_series(
    db: MongoDatabase,
    user_id: int,
    start: date,
    end: date,
    granularity: str,
) -> dict[str, Decimal]:
    filt = {
        "user_id": user_id,
        "transaction_type": _TRANSACTION_TYPE,
        "is_deleted": False,
        "date": {"$gte": start, "$lt": end},
    }
    rows = await db.find("transactions", filt, sort=[("date", 1)])
    parsed = [(date.fromisoformat(row.date), row.category, row.amount) for row in rows]
    return bucket_rows_by_period(parsed, granularity)


class RecurringPattern(BaseModel):
    category: str
    label: str
    typical_amount: Decimal
    occurrences: int
    confidence: str
    interval_days: int | None = None


_RECURRING_HINTS: dict[str, list[str]] = {
    "salary": ["salary", "payroll", "wage"],
    "rent": ["rent", "housing", "lease"],
    "emi": ["emi", "loan", "mortgage"],
    "subscription": ["subscription", "netflix", "spotify", "prime"],
    "utilities": ["electric", "water", "internet", "utility", "bill"],
}


async def detect_recurring_patterns(
    db: MongoDatabase,
    user_id: int,
    *,
    lookback_days: int = 120,
) -> list[RecurringPattern]:
    """Detect likely recurring transactions with confidence labels."""
    end = date.today()
    start = end - timedelta(days=lookback_days)
    filt = {
        "user_id": user_id,
        "is_deleted": False,
        "date": {"$gte": start, "$lte": end},
    }
    rows = await db.find("transactions", filt, sort=[("date", 1)])
    by_key: dict[tuple[str, str], list[tuple[date, Decimal]]] = defaultdict(list)
    for row in rows:
        label = _classify_recurring(row.category, row.description)
        if label:
            by_key[(label, row.category)].append(
                (date.fromisoformat(row.date), row.amount)
            )

    patterns: list[RecurringPattern] = []
    for (label, category), events in by_key.items():
        if len(events) < 2:
            continue
        amounts = [a for _, a in events]
        avg = sum(amounts, Decimal("0")) / Decimal(len(amounts))
        gaps = [(events[i][0] - events[i - 1][0]).days for i in range(1, len(events))]
        avg_gap = int(sum(gaps) / len(gaps)) if gaps else None
        confidence = "high" if len(events) >= 3 else "medium"
        patterns.append(
            RecurringPattern(
                category=category,
                label=label,
                typical_amount=avg.quantize(Decimal("0.01")),
                occurrences=len(events),
                confidence=confidence,
                interval_days=avg_gap,
            )
        )
    return sorted(patterns, key=lambda p: (-p.occurrences, p.label))


def _classify_recurring(category: str, description: str) -> str | None:
    text = f"{category} {description}".lower()
    for label, keywords in _RECURRING_HINTS.items():
        if any(k in text for k in keywords):
            return label
    if category.lower() in ("salary", "rent", "emi", "subscription", "utilities"):
        return category.lower()
    return None
