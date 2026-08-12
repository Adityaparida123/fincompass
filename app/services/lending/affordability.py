"""Affordability assessment for a proposed EMI."""

from decimal import Decimal

from app.schemas.debt import DebtBurdenInput
from app.schemas.loan import AffordabilityInput, AffordabilityResult
from app.services.finance.debt import calculate_debt_burden

CAUTION_RATIO = Decimal("40")


def assess_affordability(data: AffordabilityInput) -> AffordabilityResult:
    disposable = data.income - data.monthly_expenses - data.existing_debt_payment
    post_loan = disposable - data.proposed_emi

    debt_with = calculate_debt_burden(
        DebtBurdenInput(
            monthly_income=data.income,
            monthly_debt_payments=data.existing_debt_payment + data.proposed_emi,
        )
    ).debt_payment_ratio

    is_affordable = post_loan >= 0 and debt_with <= CAUTION_RATIO
    if not is_affordable:
        note = (
            "This EMI does not currently look affordable given your income, expenses, "
            "and existing obligations. Consider a longer tenure, lower amount, or "
            "building savings instead."
        )
    else:
        note = (
            "The EMI appears affordable based on current figures. Maintain an emergency "
            "buffer before committing."
        )
    return AffordabilityResult(
        disposable_cash_flow=disposable.quantize(Decimal("0.01")),
        post_loan_cash_flow=post_loan.quantize(Decimal("0.01")),
        debt_burden_with_loan=debt_with,
        is_affordable=is_affordable,
        note=note,
    )
