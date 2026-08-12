"""Deterministic cash flow calculations.

All monetary arithmetic uses Decimal. No LLM involvement; these are the
source of truth for financial figures.
"""

from decimal import ROUND_HALF_UP, Decimal

from app.schemas.cashflow import (
    CashFlowInput,
    CashFlowResult,
    SavingsCapacityInput,
    SavingsCapacityResult,
)

_CENT = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return value.quantize(_CENT, rounding=ROUND_HALF_UP)


def calculate_cash_flow(input_data: CashFlowInput) -> CashFlowResult:
    total_outflow = (
        input_data.essential_expenses
        + input_data.discretionary_expenses
        + input_data.debt_payments
    )
    available = input_data.income - total_outflow
    return CashFlowResult(
        income=_money(input_data.income),
        essential_expenses=_money(input_data.essential_expenses),
        discretionary_expenses=_money(input_data.discretionary_expenses),
        debt_payments=_money(input_data.debt_payments),
        total_outflow=_money(total_outflow),
        available_cash_flow=_money(available),
        is_positive=available >= 0,
    )


def calculate_savings_capacity(input_data: SavingsCapacityInput) -> SavingsCapacityResult:
    estimated = input_data.income - input_data.expenses - input_data.debt_payments
    if input_data.income > 0:
        rate = (estimated / input_data.income) * Decimal("100")
    else:
        rate = Decimal("0")
    rate = rate.quantize(Decimal("0.01"))
    return SavingsCapacityResult(
        estimated_monthly_savings=estimated,
        savings_rate=rate,
    )
