"""What-if scenario simulator.

Deterministic, explainable what-if analysis built on the same data and the
same health engine used for the user's real score. The simulator never
writes to the database; it only models the effect of user-supplied changes
on their averaged monthly position and Financial Health Score.

Each change is applied to the averaged inputs (3-month history):

    income_delta   flat monthly top-up/minus added to every income month
    expenses_delta flat monthly add/remove applied to every expense month
    debt_delta     change to recurring monthly debt obligations
    savings_contribution  monthly amount moved to savings (reduces spendable
                          cash but grows the savings balance every month)
    one_time_purchase     one-off cash outlay charged to the savings balance

The scenario health score is computed by ``compute_health`` on the adjusted
inputs, so every pillar responds exactly as it would to real data.
"""

from dataclasses import dataclass
from decimal import Decimal

from app.schemas.advisor import BaselineSnapshot
from app.services.health.engine import compute_health
from app.services.readiness.engine import ReadinessInput

ZERO = Decimal("0")


@dataclass
class ScenarioDeltas:
    income_delta: Decimal = ZERO
    expenses_delta: Decimal = ZERO
    debt_delta: Decimal = ZERO
    savings_contribution: Decimal = ZERO
    one_time_purchase: Decimal = ZERO


def _avg(values: list[Decimal]) -> Decimal:
    return (sum(values) / Decimal(len(values))).quantize(Decimal("0.01")) if values else ZERO


def apply_deltas(base: ReadinessInput, deltas: ScenarioDeltas) -> ReadinessInput:
    income_months = [m + deltas.income_delta for m in base.income_months]
    expense_months = [m + deltas.expenses_delta for m in base.expense_months]
    if not income_months and (base.income + deltas.income_delta) != ZERO:
        income_months = [base.income + deltas.income_delta]
    if not expense_months and (base.total_expenses + deltas.expenses_delta) != ZERO:
        expense_months = [base.total_expenses + deltas.expenses_delta]

    income = _avg(income_months)
    total_expenses = _avg(expense_months)

    essential_delta = Decimal("0")
    if total_expenses > ZERO:
        ratio = base.essential_monthly_expenses / _avg(base.expense_months) if _avg(base.expense_months) > ZERO else ZERO
        essential_delta = (total_expenses * ratio).quantize(Decimal("0.01"))

    # A recurring savings contribution is cash set aside each month; it does
    # not reappear in the expense average, it grows the savings balance.
    savings = base.savings + deltas.savings_contribution - deltas.one_time_purchase

    return ReadinessInput(
        income=income,
        total_expenses=total_expenses,
        essential_monthly_expenses=essential_delta,
        debt_payments=base.debt_payments + deltas.debt_delta,
        savings=savings,
        income_months=income_months,
        expense_months=expense_months,
    )


def _buffer_months(savings: Decimal, essential: Decimal, total_expenses: Decimal) -> float | None:
    base = essential if essential > ZERO else total_expenses
    if base <= ZERO:
        return None
    return round(float(savings / base), 2)


def build_snapshot(ri: ReadinessInput) -> BaselineSnapshot:
    income = ri.income
    total_expenses = ri.total_expenses
    essential = ri.essential_monthly_expenses
    debt = ri.debt_payments
    savings = ri.savings
    net_cash_flow = (income - total_expenses - debt).quantize(Decimal("0.01"))

    health = compute_health(ri)
    has_data = income > ZERO or total_expenses > ZERO or debt > ZERO or savings > ZERO

    savings_rate = None
    if income > ZERO:
        savings_rate = round(float((net_cash_flow / income) * 100), 1)

    return BaselineSnapshot(
        income=income if income > ZERO else None,
        total_expenses=total_expenses if total_expenses > ZERO else None,
        essential_monthly_expenses=essential if essential > ZERO else None,
        debt_payments=debt if debt > ZERO else None,
        net_cash_flow=net_cash_flow,
        savings_balance=savings if savings != ZERO else None,
        buffer_months=_buffer_months(savings, essential, total_expenses),
        savings_rate_percent=savings_rate,
        health_score=health.score if has_data else None,
        health_label=health.label if has_data else None,
    )


def risk_label(ri: ReadinessInput, snapshot: BaselineSnapshot | None = None) -> str:
    snap = snapshot or build_snapshot(ri)
    net = snap.net_cash_flow
    if net < ZERO:
        return "cash_shortfall"
    if snap.buffer_months is not None and snap.buffer_months < 3:
        return "low_buffer"
    if ri.income <= ZERO:
        return "insufficient_data"
    return "stable"


RISK_LABELS = {
    "stable": "Your projected monthly position remains positive with an adequate cash buffer.",
    "low_buffer": "Cash flow stays positive but the monthly buffer is below 3 months of expenses.",
    "cash_shortfall": "Projected monthly expenses and debt exceed income in this scenario.",
    "insufficient_data": "Not enough recorded income/expense data to judge the risk of this scenario.",
}


def _fmt(value: Decimal) -> str:
    return f"{value:,.2f}"


def fmt_value(value: Decimal | None) -> str:
    return _fmt(value) if value is not None else "0.00"