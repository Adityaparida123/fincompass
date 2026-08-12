"""Expense analysis helpers (deterministic aggregation)."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.transaction import Transaction, TransactionType
from app.utils.dates import period_key

MONTHLY_REPORT_PERIODS = 6


async def expense_totals(
    db: AsyncSession,
    user_id: int,
    start: date,
    end: date,
) -> tuple[Decimal, int]:
    stmt = select(func.coalesce(func.sum(Transaction.amount), 0), func.count()).where(
        Transaction.user_id == user_id,
        Transaction.transaction_type == TransactionType.expense,
        Transaction.is_deleted.is_(False),
        Transaction.date >= start,
        Transaction.date < end,
    )
    row = (await db.execute(stmt)).one()
    return Decimal(row[0]), int(row[1])


async def income_totals(db: AsyncSession, user_id: int, start: date, end: date) -> Decimal:
    stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user_id,
        Transaction.transaction_type == TransactionType.income,
        Transaction.is_deleted.is_(False),
        Transaction.date >= start,
        Transaction.date < end,
    )
    value = (await db.execute(stmt)).scalar_one()
    return Decimal(value)


def category_totals_stmt(user_id: int, start: date, end: date) -> Select:
    return (
        select(
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
            func.count().label("count"),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.is_deleted.is_(False),
            Transaction.date >= start,
            Transaction.date < end,
        )
        .group_by(Transaction.category)
    )


async def category_totals(
    db: AsyncSession, user_id: int, start: date, end: date
) -> list[tuple[str, Decimal, int]]:
    rows = (await db.execute(category_totals_stmt(user_id, start, end))).all()
    return [(r.category, Decimal(r.total), int(r.count)) for r in rows]


def bucket_rows_by_period(
    rows: list[tuple[date, str, Decimal]], granularity: str
) -> dict[str, Decimal]:
    buckets: dict[str, Decimal] = {}
    for d, _cat, amount in rows:
        key = period_key(d, granularity)
        buckets[key] = buckets.get(key, Decimal("0")) + amount
    return buckets


async def expense_series(
    db: AsyncSession,
    user_id: int,
    start: date,
    end: date,
    granularity: str,
) -> dict[str, Decimal]:
    stmt = (
        select(Transaction.date, Transaction.category, Transaction.amount)
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.is_deleted.is_(False),
            Transaction.date >= start,
            Transaction.date < end,
        )
        .order_by(Transaction.date)
    )
    rows = (await db.execute(stmt)).all()
    return bucket_rows_by_period(list(rows), granularity)


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
    db: AsyncSession,
    user_id: int,
    *,
    lookback_days: int = 120,
) -> list[RecurringPattern]:
    """Detect likely recurring transactions with confidence labels."""
    end = date.today()
    start = end - timedelta(days=lookback_days)
    stmt = (
        select(Transaction.date, Transaction.category, Transaction.description, Transaction.amount)
        .where(
            Transaction.user_id == user_id,
            Transaction.is_deleted.is_(False),
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .order_by(Transaction.date)
    )
    rows = (await db.execute(stmt)).all()
    by_key: dict[tuple[str, str], list[tuple[date, Decimal]]] = defaultdict(list)
    for row in rows:
        label = _classify_recurring(row.category, row.description)
        if label:
            by_key[(label, row.category)].append((row.date, Decimal(row.amount)))

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
