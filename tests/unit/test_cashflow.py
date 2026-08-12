"""Unit tests for cash flow and savings capacity."""

from decimal import Decimal

import pytest

from app.schemas.cashflow import CashFlowInput, SavingsCapacityInput
from app.services.finance.cashflow import calculate_cash_flow, calculate_savings_capacity


def test_cash_flow_example():
    result = calculate_cash_flow(
        CashFlowInput(
            income=Decimal("45000"),
            essential_expenses=Decimal("20000"),
            discretionary_expenses=Decimal("5000"),
            debt_payments=Decimal("5000"),
        )
    )
    assert result.income == Decimal("45000")
    assert result.total_outflow == Decimal("30000")
    assert result.available_cash_flow == Decimal("15000")
    assert result.is_positive is True


def test_cash_flow_negative():
    result = calculate_cash_flow(
        CashFlowInput(
            income=Decimal("20000"),
            essential_expenses=Decimal("15000"),
            discretionary_expenses=Decimal("5000"),
            debt_payments=Decimal("5000"),
        )
    )
    assert result.available_cash_flow == Decimal("-5000")
    assert result.is_positive is False


def test_zero_expenses():
    result = calculate_cash_flow(
        CashFlowInput(
            income=Decimal("10000"),
            essential_expenses=Decimal("0"),
            discretionary_expenses=Decimal("0"),
            debt_payments=Decimal("0"),
        )
    )
    assert result.available_cash_flow == Decimal("10000")


def test_savings_capacity_example():
    result = calculate_savings_capacity(
        SavingsCapacityInput(
            income=Decimal("45000"),
            expenses=Decimal("25000"),
            debt_payments=Decimal("5000"),
        )
    )
    assert result.estimated_monthly_savings == Decimal("15000")
    assert result.savings_rate == Decimal("33.33")
    assert result.is_estimate is True


def test_savings_capacity_zero_income_rate():
    with pytest.raises(Exception):
        SavingsCapacityInput(income=Decimal("0"), expenses=Decimal("0"), debt_payments=Decimal("0"))


def test_savings_capacity_negative_savings():
    result = calculate_savings_capacity(
        SavingsCapacityInput(
            income=Decimal("10000"),
            expenses=Decimal("15000"),
            debt_payments=Decimal("0"),
        )
    )
    assert result.estimated_monthly_savings == Decimal("-5000")
    assert result.savings_rate == Decimal("-50.00")
