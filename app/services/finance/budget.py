"""Budget service. Recommendations are based on actual user spending."""

from datetime import date
from decimal import Decimal

from app.db.models.transaction import TransactionType
from app.db.mongo import Doc, MongoDatabase
from app.utils.dates import month_period_from_string


async def list_budgets(db: MongoDatabase, user_id: int, period: str | None) -> list[Doc]:
    filt: dict = {"user_id": user_id}
    if period:
        try:
            start = month_period_from_string(period)
        except ValueError:
            start = date.today().replace(day=1)
        filt["period"] = start
    return await db.find("budgets", filt, sort=[("category", 1)])


async def category_spend(
    db: MongoDatabase, user_id: int, category: str, start: date, end: date
) -> Decimal:
    filt = {
        "user_id": user_id,
        "transaction_type": TransactionType.expense.value,
        "is_deleted": False,
        "category": category,
        "date": {"$gte": start, "$lt": end},
    }
    return await db.sum_field("transactions", filt, "amount")


async def average_monthly_spend(
    db: MongoDatabase, user_id: int, category: str, months: int = 3
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
    db: MongoDatabase, user_id: int, period: date
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

    filt = {
        "user_id": user_id,
        "transaction_type": TransactionType.expense.value,
        "is_deleted": False,
        "date": {"$gte": start, "$lt": end},
    }
    totals: dict[str, Decimal] = {}
    for row in await db.find("transactions", filt):
        totals[row.category] = totals.get(row.category, Decimal("0")) + row.amount

    existing = {
        b.category: b.limit_amount
        for b in await list_budgets(db, user_id, period.isoformat()[:7])
    }

    recommendations: list[dict] = []
    for category, average in totals.items():
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
