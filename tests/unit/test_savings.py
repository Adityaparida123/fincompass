"""Unit tests for emergency fund calculations and savings schema serialization."""

from datetime import date
from decimal import Decimal

from app.schemas.savings import EmergencyBufferInput, SavingsGoalRead, SavingsGoalStatus
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


def test_savings_goal_read_serializes_decimals_as_strings():
    """Pydantic v2 serializes Decimal fields as strings in JSON mode."""
    goal = SavingsGoalRead(
        id=1,
        name="Emergency Fund",
        target_amount=Decimal("500000.00"),
        current_amount=Decimal("125000.00"),
        target_date=date(2026, 12, 31),
        status=SavingsGoalStatus.active,
        progress_percent=Decimal("25.00"),
    )
    dumped = goal.model_dump(mode="json")
    assert isinstance(dumped["target_amount"], str)
    assert dumped["target_amount"] == "500000.00"
    assert isinstance(dumped["current_amount"], str)
    assert dumped["current_amount"] == "125000.00"
    assert isinstance(dumped["progress_percent"], str)
    assert dumped["progress_percent"] == "25.00"


def test_savings_goal_read_zero_progress():
    goal = SavingsGoalRead(
        id=2,
        name="Vacation Fund",
        target_amount=Decimal("100000.00"),
        current_amount=Decimal("0.00"),
        target_date=None,
        status=SavingsGoalStatus.active,
        progress_percent=Decimal("0.00"),
    )
    dumped = goal.model_dump(mode="json")
    assert dumped["progress_percent"] == "0.00"
    assert dumped["current_amount"] == "0.00"


def test_savings_goal_read_full_progress():
    goal = SavingsGoalRead(
        id=3,
        name="Completed Goal",
        target_amount=Decimal("50000.00"),
        current_amount=Decimal("50000.00"),
        target_date=date(2025, 6, 1),
        status=SavingsGoalStatus.completed,
        progress_percent=Decimal("100.00"),
    )
    dumped = goal.model_dump(mode="json")
    assert dumped["progress_percent"] == "100.00"
    assert dumped["current_amount"] == "50000.00"
