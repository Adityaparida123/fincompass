"""Unit tests for emergency fund calculations."""

from decimal import Decimal

from app.schemas.savings import EmergencyBufferInput
from app.services.finance.emergency_fund import calculate_emergency_buffer


def test_emergency_buffer_example():
    result = calculate_emergency_buffer(
        EmergencyBufferInput(
            savings=Decimal("75000"),
            essential_monthly_expenses=Decimal("20000"),
        )
    )
    assert result.savings == Decimal("75000")
    assert result.essential_monthly_expenses == Decimal("20000")
    assert result.months_covered == Decimal("3.75")
    assert result.is_adequate is False


def test_emergency_buffer_adequate():
    result = calculate_emergency_buffer(
        EmergencyBufferInput(
            savings=Decimal("120000"),
            essential_monthly_expenses=Decimal("20000"),
        )
    )
    assert result.months_covered == Decimal("6.00")
    assert result.is_adequate is True


def test_emergency_buffer_zero_savings():
    result = calculate_emergency_buffer(
        EmergencyBufferInput(
            savings=Decimal("0"),
            essential_monthly_expenses=Decimal("20000"),
        )
    )
    assert result.months_covered == Decimal("0.00")
    assert result.is_adequate is False
