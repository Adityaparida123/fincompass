"""Build ReadinessInput from the user's actual consented financial data."""

from datetime import date
from decimal import Decimal

from app.db.enums import TransactionType
from app.db.mongo import MongoDatabase
from app.schemas.transaction import is_essential
from app.services.readiness.engine import ReadinessInput

HISTORY_MONTHS = 3


async def _monthly_totals(
    db: MongoDatabase,
    user_id: int,
    tx_type: TransactionType,
    start: date,
    end: date,
) -> dict[str, Decimal]:
    filt = {
        "user_id": user_id,
        "transaction_type": tx_type.value,
        "is_deleted": False,
        "date": {"$gte": start, "$lt": end},
    }
    totals: dict[str, Decimal] = {}
    for row in await db.find("transactions", filt):
        key = row.date[:7]
        totals[key] = totals.get(key, Decimal("0")) + row.amount
    return totals


async def _month_bounds(today: date) -> list[tuple[date, date]]:
    bounds: list[tuple[date, date]] = []
    year, month = today.year, today.month
    for _ in range(HISTORY_MONTHS):
        start = date(year, month, 1)
        end = date(year, month + 1, 1) if month < 12 else date(year + 1, 1, 1)
        bounds.append((start, end))
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1
    return list(reversed(bounds))


async def build_readiness_input(db: MongoDatabase, user_id: int) -> ReadinessInput:
    today = date.today()
    bounds = await _month_bounds(today)
    window_start = bounds[0][0]
    window_end = bounds[-1][1]

    income_by_month = await _monthly_totals(db, user_id, TransactionType.income, window_start, window_end)
    expense_by_month = await _monthly_totals(db, user_id, TransactionType.expense, window_start, window_end)

    essential_by_month: dict[str, Decimal] = {}
    filt = {
        "user_id": user_id,
        "transaction_type": TransactionType.expense.value,
        "is_deleted": False,
        "date": {"$gte": window_start, "$lt": window_end},
    }
    for row in await db.find("transactions", filt):
        if is_essential(row.category):
            key = row.date[:7]
            essential_by_month[key] = essential_by_month.get(key, Decimal("0")) + row.amount

    def _month_key(start: date) -> str:
        return start.isoformat()[:7]

    income_months = [income_by_month.get(_month_key(start), Decimal("0")) for start, _ in bounds]
    expense_months = [expense_by_month.get(_month_key(start), Decimal("0")) for start, _ in bounds]
    essential_months = [essential_by_month.get(_month_key(start), Decimal("0")) for start, _ in bounds]

    monthly_debt = await db.sum_field("debt_obligations", {"user_id": user_id}, "monthly_payment")
    savings = await db.sum_field("savings_goals", {"user_id": user_id}, "current_amount")

    def _avg(values: list[Decimal]) -> Decimal:
        return (sum(values) / Decimal(len(values))).quantize(Decimal("0.01")) if values else Decimal("0")

    return ReadinessInput(
        income=_avg(income_months),
        total_expenses=_avg(expense_months),
        essential_monthly_expenses=_avg(essential_months),
        debt_payments=monthly_debt,
        savings=savings,
        income_months=income_months,
        expense_months=expense_months,
    )
