"""Budget service. Recommendations are based on actual user spending."""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.budget import Budget
from app.db.models.transaction import Transaction, TransactionType
from app.utils.dates import month_period_from_string


async def list_budgets(db: AsyncSession, user_id: int, period: str | None) -> list[Budget]:
    stmt = select(Budget).where(Budget.user_id == user_id)
    if period:
        try:
            start = month_period_from_string(period)
        except ValueError:
            start = date.today().replace(day=1)
        stmt = stmt.where(Budget.period == start)
    stmt = stmt.order_by(Budget.category)
    return list((await db.execute(stmt)).scalars().all())


async def category_spend(
    db: AsyncSession, user_id: int, category: str, start: date, end: date
) -> Decimal:
    stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user_id,
        Transaction.transaction_type == TransactionType.expense,
        Transaction.is_deleted.is_(False),
        Transaction.category == category,
        Transaction.date >= start,
        Transaction.date < end,
    )
    return Decimal((await db.execute(stmt)).scalar_one())


async def average_monthly_spend(
    db: AsyncSession, user_id: int, category: str, months: int = 3
) -> Decimal:
    """Average actual spend for a category over the last N full months."""
    today = date.today()
    total = Decimal("0")
    counted = 0
    for offset in range(1, months + 1):
        # approximate last N calendar months using month bounds
        year = today.year
        month = today.month - offset
        while month <= 0:
            month += 12
            year -= 1
        if month == 12:
            start = date(year, 12, 1)
            end = date(year + 1, 1, 1)
        else:
            start = date(year, month, 1)
            end = date(year, month + 1, 1)
        spend = await category_spend(db, user_id, category, start, end)
        total += spend
        counted += 1
    if counted == 0:
        return Decimal("0")
    return (total / Decimal(counted)).quantize(Decimal("0.01"))


async def build_recommendations(
    db: AsyncSession, user_id: int, period: date
) -> list[dict]:
    """Suggest budget limits based on the user's own recent spending.

    Uses the 80th-percentile-style heuristic: suggested limit is the larger
    of (average spend * 1.15) or (average spend), floored to a sensible value.
    This is data-driven and does not assume a one-size-fits-all rule.
    """
    start = period.replace(day=1)
    if period.month == 12:
        end = period.replace(year=period.year + 1, month=1, day=1)
    else:
        end = period.replace(month=period.month + 1, day=1)

    rows = await db.execute(
        select(
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
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
    existing = {
        b.category: b.limit_amount
        for b in await list_budgets(db, user_id, period.isoformat()[:7])
    }

    recommendations: list[dict] = []
    for category, total in rows.all():
        average = Decimal(total)
        suggested = (average * Decimal("1.15")).quantize(Decimal("0.01"))
        recommendations.append(
            {
                "category": category,
                "suggested_limit": suggested,
                "current_limit": existing.get(category),
                "average_spend": average,
                "rationale": (
                    f"Based on your actual spending of {average:,.2f} in this category "
                    f"during {period.isoformat()[:7]}, a limit of {suggested:,.2f} "
                    "keeps ~15% headroom."
                ),
            }
        )
    recommendations.sort(key=lambda r: -float(r["average_spend"]))
    return recommendations
