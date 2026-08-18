"""Debt calculations."""

from decimal import Decimal

from app.schemas.debt import DebtBurdenInput, DebtBurdenResult

SAFE_GUIDANCE_RATIO = Decimal("40")


def calculate_debt_burden(input_data: DebtBurdenInput) -> DebtBurdenResult:
    if input_data.monthly_income <= 0:
        ratio = Decimal("0")
    else:
        ratio = (input_data.monthly_debt_payments / input_data.monthly_income) * Decimal("100")
        ratio = ratio.quantize(Decimal("0.01"))
    note = (
        "Debt burden is presented for context only. Whether debt is manageable depends on "
        "cash flow stability, savings, emergency buffer, and repayment history, not this "
        "ratio alone."
    )
    return DebtBurdenResult(
        monthly_income=input_data.monthly_income,
        monthly_debt_payments=input_data.monthly_debt_payments,
        debt_payment_ratio=ratio,
        context_note=note,
    )
