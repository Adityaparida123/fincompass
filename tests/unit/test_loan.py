"""Unit tests for the loan simulator."""

from decimal import Decimal

from app.schemas.loan import LoanSimulationRequest
from app.services.lending.loan_simulator import simulate_loan


def test_loan_simulation_example():
    result = simulate_loan(
        LoanSimulationRequest(
            income=Decimal("45000"),
            monthly_expenses=Decimal("29800"),
            existing_debt_payment=Decimal("5000"),
            loan_amount=Decimal("100000"),
            interest_rate=Decimal("12"),
            tenure_months=12,
        )
    )
    assert result.emi == Decimal("8884.88")
    assert result.cash_flow_before == Decimal("10200.00")
    assert result.cash_flow_after == Decimal("1315.12")
    assert result.debt_burden_before == Decimal("11.11")
    assert result.debt_burden_after == Decimal("30.86")
    assert len(result.alternatives) >= 3


def test_loan_simulation_warns_when_unaffordable():
    result = simulate_loan(
        LoanSimulationRequest(
            income=Decimal("30000"),
            monthly_expenses=Decimal("25000"),
            existing_debt_payment=Decimal("3000"),
            loan_amount=Decimal("500000"),
            interest_rate=Decimal("14"),
            tenure_months=24,
        )
    )
    assert result.warnings, "Expected warnings for an unaffordable loan."
    assert "negative" in result.warnings[0].lower()


def test_loan_simulation_zero_interest():
    result = simulate_loan(
        LoanSimulationRequest(
            income=Decimal("45000"),
            monthly_expenses=Decimal("20000"),
            existing_debt_payment=Decimal("0"),
            loan_amount=Decimal("12000"),
            interest_rate=Decimal("0"),
            tenure_months=12,
        )
    )
    assert result.emi == Decimal("1000.00")


def test_loan_simulation_assumptions_documented():
    result = simulate_loan(
        LoanSimulationRequest(
            income=Decimal("50000"),
            monthly_expenses=Decimal("25000"),
            existing_debt_payment=Decimal("5000"),
            loan_amount=Decimal("100000"),
            interest_rate=Decimal("10"),
            tenure_months=24,
        )
    )
    assert len(result.assumptions) > 0
    assert any("EMI computed" in a for a in result.assumptions)


def test_loan_simulation_never_recommends_unconditionally():
    result = simulate_loan(
        LoanSimulationRequest(
            income=Decimal("45000"),
            monthly_expenses=Decimal("29800"),
            existing_debt_payment=Decimal("5000"),
            loan_amount=Decimal("100000"),
            interest_rate=Decimal("12"),
            tenure_months=12,
        )
    )
    assert "take the loan" not in result.recommendation.lower()
    assert "consider" in result.recommendation.lower() or "appears repayable" in result.recommendation.lower()
