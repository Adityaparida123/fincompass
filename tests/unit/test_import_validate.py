"""Unit tests for row-level validation warnings."""

from datetime import date, timedelta
from decimal import Decimal

from app.services.import_statement.validate import validate_row


def test_clean_row_no_warnings():
    warnings = validate_row(
        tx_date=date.today(),
        amount=Decimal("100.00"),
        description="UPI DR Swiggy",
    )
    assert warnings == []


def test_future_date_warns():
    warnings = validate_row(
        tx_date=date.today() + timedelta(days=1),
        amount=Decimal("100.00"),
        description="UPI DR Swiggy",
    )
    assert "date_in_future" in warnings


def test_very_old_date_warns():
    warnings = validate_row(
        tx_date=date.today() - timedelta(days=365 * 11),
        amount=Decimal("100.00"),
        description="UPI DR Swiggy",
    )
    assert "date_very_old" in warnings


def test_non_positive_amount_warns():
    warnings = validate_row(
        tx_date=date.today(),
        amount=Decimal("0.00"),
        description="UPI DR Swiggy",
    )
    assert "non_positive_amount" in warnings


def test_ambiguous_description_warns():
    warnings = validate_row(
        tx_date=date.today(),
        amount=Decimal("100.00"),
        description="  ",
    )
    assert "ambiguous_description" in warnings


def test_multiple_warnings_accumulate():
    warnings = validate_row(
        tx_date=date.today() + timedelta(days=5),
        amount=Decimal("0.00"),
        description="",
    )
    assert set(warnings) == {"date_in_future", "non_positive_amount", "ambiguous_description"}
