"""Loan simulator combining EMI, cash flow, and debt burden impact."""

from decimal import Decimal

from app.schemas.debt import DebtBurdenInput
from app.schemas.loan import (
    LoanAlternative,
    LoanSimulationRequest,
    LoanSimulationResult,
)
from app.services.finance.debt import calculate_debt_burden
from app.services.lending.emi import calculate_emi

DEBT_RATIO_CAUTION = Decimal("40")
CASH_FLOW_BUFFER = Decimal("0")


def simulate_loan(data: LoanSimulationRequest) -> LoanSimulationResult:
    emi = calculate_emi(data.loan_amount, data.interest_rate, data.tenure_months)

    total_before = data.monthly_expenses + data.existing_debt_payment
    cash_flow_before = data.income - total_before

    total_after = data.monthly_expenses + data.existing_debt_payment + emi
    cash_flow_after = data.income - total_after

    debt_before = calculate_debt_burden(
        DebtBurdenInput(
            monthly_income=data.income,
            monthly_debt_payments=data.existing_debt_payment,
        )
    ).debt_payment_ratio

    debt_after = calculate_debt_burden(
        DebtBurdenInput(
            monthly_income=data.income,
            monthly_debt_payments=data.existing_debt_payment + emi,
        )
    ).debt_payment_ratio

    affordability_ratio = (
        (data.existing_debt_payment + emi) / data.income
    ) * Decimal("100")

    warnings: list[str] = []
    alternatives: list[LoanAlternative] = []

    if cash_flow_after < CASH_FLOW_BUFFER:
        warnings.append(
            "After this loan, monthly cash flow would become negative. "
            "This loan is not currently affordable."
        )
    if debt_after > DEBT_RATIO_CAUTION:
        warnings.append(
            f"Debt payments would reach {debt_after:.1f}% of monthly income, "
            f"above the {DEBT_RATIO_CAUTION:.0f}% caution threshold."
        )
    if cash_flow_before < emi:
        warnings.append(
            "The EMI exceeds your current available cash flow before accounting for "
            "any additional expenses."
        )

    alternatives.append(
        LoanAlternative(
            type="savings",
            title="Save toward the goal instead",
            description="Building a dedicated savings fund avoids interest and repayment risk.",
        )
    )
    alternatives.append(
        LoanAlternative(
            type="budgeting",
            title="Review budget first",
            description="Reallocating discretionary spending may cover the need without a loan.",
        )
    )
    alternatives.append(
        LoanAlternative(
            type="scheme",
            title="Check public assistance",
            description="Potentially relevant government schemes may offer support or subsidies.",
        )
    )

    assumptions = [
        f"EMI computed at {data.interest_rate}% p.a. over {data.tenure_months} months "
        "on reducing balance.",
        "Cash flow assumes reported income, expenses, and existing debt remain stable.",
        "Debt burden is the share of monthly income used for debt payments.",
    ]

    recommendation = _recommendation(cash_flow_after, debt_after, emi, cash_flow_before)

    return LoanSimulationResult(
        emi=emi,
        cash_flow_before=cash_flow_before.quantize(Decimal("0.01")),
        cash_flow_after=cash_flow_after.quantize(Decimal("0.01")),
        debt_burden_before=debt_before,
        debt_burden_after=debt_after,
        affordability_ratio=affordability_ratio.quantize(Decimal("0.01")),
        warnings=warnings,
        alternatives=alternatives,
        assumptions=assumptions,
        recommendation=recommendation,
    )


def _recommendation(
    cash_flow_after: Decimal, debt_after: Decimal, emi: Decimal, cash_flow_before: Decimal
) -> str:
    if cash_flow_after < 0:
        return (
            "This loan would leave you with negative cash flow. Strongly consider "
            "alternatives such as building savings or reducing expenses before borrowing."
        )
    if debt_after > DEBT_RATIO_CAUTION:
        return (
            "The loan is technically repayable but would push debt payments above a "
            "caution threshold. Weigh the trade-off carefully and consider alternatives."
        )
    return (
        "Based on the figures provided, the loan appears repayable. Still, confirm you "
        "have an emergency buffer and that borrowing is necessary rather than optional."
    )
