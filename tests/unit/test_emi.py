"""Unit tests for the EMI calculator."""

from decimal import Decimal

import pytest

from app.core.exceptions import InvalidInputError
from app.services.lending.emi import calculate_emi, emi_result


def test_emi_standard_case():
    emi = calculate_emi(Decimal("100000"), Decimal("12"), 12)
    assert emi == Decimal("8884.88")


def test_emi_total_interest():
    result = emi_result(Decimal("100000"), Decimal("12"), 12)
    assert result.monthly_emi == Decimal("8884.88")
    assert result.total_payment == Decimal("106618.56")
    assert result.total_interest == Decimal("6618.56")
    assert result.zero_interest is False


def test_zero_interest_loan():
    emi = calculate_emi(Decimal("12000"), Decimal("0"), 12)
    assert emi == Decimal("1000.00")
    result = emi_result(Decimal("12000"), Decimal("0"), 12)
    assert result.total_interest == Decimal("0")
    assert result.zero_interest is True


def test_zero_interest_division_exact():
    emi = calculate_emi(Decimal("100000"), Decimal("0"), 12)
    assert emi == Decimal("8333.33")


@pytest.mark.parametrize(
    "principal,rate,tenure",
    [
        (Decimal("0"), Decimal("12"), 12),
        (Decimal("-100"), Decimal("12"), 12),
        (Decimal("100"), Decimal("-1"), 12),
        (Decimal("100"), Decimal("12"), 0),
        (Decimal("100"), Decimal("12"), -5),
    ],
)
def test_emi_invalid_inputs_raise(principal, rate, tenure):
    with pytest.raises(InvalidInputError):
        calculate_emi(principal, rate, tenure)


def test_emi_precision_large_amounts():
    emi = calculate_emi(Decimal("100000000"), Decimal("15.5"), 120)
    assert emi == Decimal("1644105.37")


def test_emi_is_deterministic():
    assert calculate_emi(Decimal("50000"), Decimal("10.5"), 24) == calculate_emi(
        Decimal("50000"), Decimal("10.5"), 24
    )
