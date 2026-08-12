"""Unit tests for debt burden calculations."""

from decimal import Decimal

import pytest

from app.schemas.debt import DebtBurdenInput
from app.services.finance.debt import calculate_debt_burden


def test_debt_burden_example():
    result = calculate_debt_burden(
        DebtBurdenInput(
            monthly_income=Decimal("45000"),
            monthly_debt_payments=Decimal("5000"),
        )
    )
    assert result.monthly_income == Decimal("45000")
    assert result.monthly_debt_payments == Decimal("5000")
    assert result.debt_payment_ratio == Decimal("11.11")


def test_debt_burden_zero():
    result = calculate_debt_burden(
        DebtBurdenInput(monthly_income=Decimal("45000"), monthly_debt_payments=Decimal("0"))
    )
    assert result.debt_payment_ratio == Decimal("0.00")


def test_debt_burden_high():
    result = calculate_debt_burden(
        DebtBurdenInput(monthly_income=Decimal("45000"), monthly_debt_payments=Decimal("30000"))
    )
    assert result.debt_payment_ratio == Decimal("66.67")


def test_debt_burden_context_note_present():
    result = calculate_debt_burden(
        DebtBurdenInput(monthly_income=Decimal("10000"), monthly_debt_payments=Decimal("1000"))
    )
    assert "context" in result.context_note.lower()


@pytest.mark.parametrize(
    "income,payments",
    [
        (Decimal("0"), Decimal("100")),
        (Decimal("-100"), Decimal("10")),
    ],
)
def test_debt_burden_invalid(income, payments):
    with pytest.raises(Exception):
        DebtBurdenInput(monthly_income=income, monthly_debt_payments=payments)
