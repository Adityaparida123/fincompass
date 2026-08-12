"""Build ReadinessInput from the user's actual consented financial data."""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.debt import DebtObligation
from app.db.models.savings import SavingsGoal
from app.db.models.transaction import Transaction, TransactionType
from app.schemas.transaction import is_essential
from app.services.readiness.engine import ReadinessInput

HISTORY_MONTHS = 3


async def _monthly_totals(
    db: AsyncSession,
    user_id: int,
    tx_type: TransactionType,
    start: date,
    end: date,
) -> dict[str, Decimal]:
    stmt = (
        select(Transaction.date, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == tx_type,
            Transaction.is_deleted.is_(False),
            Transaction.date >= start,
            Transaction.date < end,
        )
        .group_by(Transaction.date)
    )
    rows = (await db.execute(stmt)).all()
    totals: dict[str, Decimal] = {}
    for day, amount in rows:
        key = f"{day.year}-{day.month:02d}"
        totals[key] = totals.get(key, Decimal("0")) + Decimal(amount)
    return totals


async def _month_bounds(today: date) -> list[tuple[date, date]]:
    bounds: list[tuple[date, date]] = []
    year, month = today.year, today.month
    for _ in range(HISTORY_MONTHS):
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1
        start = date(year, month, 1)
        end = date(year, month + 1, 1) if month < 12 else date(year + 1, 1, 1)
        bounds.append((start, end))
    return list(reversed(bounds))


async def build_readiness_input(db: AsyncSession, user_id: int) -> ReadinessInput:
    today = date.today()
    bounds = await _month_bounds(today)
    window_start = bounds[0][0]
    window_end = bounds[-1][1]

    income_by_month = await _monthly_totals(db, user_id, TransactionType.income, window_start, window_end)
    expense_by_month = await _monthly_totals(db, user_id, TransactionType.expense, window_start, window_end)

    essential_by_month: dict[str, Decimal] = {}
    stmt = (
        select(Transaction.date, Transaction.category, Transaction.amount)
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.is_deleted.is_(False),
            Transaction.date >= window_start,
            Transaction.date < window_end,
        )
    )
    rows = (await db.execute(stmt)).all()
    for day, category, amount in rows:
        if is_essential(category):
            key = f"{day.year}-{day.month:02d}"
            essential_by_month[key] = essential_by_month.get(key, Decimal("0")) + Decimal(amount)

    income_months = [income_by_month.get(key, Decimal("0")) for key, _ in bounds]
    expense_months = [expense_by_month.get(key, Decimal("0")) for key, _ in bounds]
    essential_months = [essential_by_month.get(key, Decimal("0")) for key, _ in bounds]

    total_debt_stmt = select(func.coalesce(func.sum(DebtObligation.monthly_payment), 0)).where(
        DebtObligation.user_id == user_id
    )
    monthly_debt = Decimal((await db.execute(total_debt_stmt)).scalar_one())

    total_savings_stmt = select(func.coalesce(func.sum(SavingsGoal.current_amount), 0)).where(
        SavingsGoal.user_id == user_id
    )
    savings = Decimal((await db.execute(total_savings_stmt)).scalar_one())

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
