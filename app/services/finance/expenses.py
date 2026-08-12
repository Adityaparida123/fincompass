"""Expense analysis helpers (deterministic aggregation)."""

from datetime import date
from decimal import Decimal

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
    return bucket_rows_by_period(rows, granularity)
