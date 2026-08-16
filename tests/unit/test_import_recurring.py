"""Unit tests for in-statement recurring detection."""

from datetime import date
from decimal import Decimal

from app.services.import_statement.recurring import detect_recurring


class _Row:
    def __init__(self, row_number, merchant, description, category, amount, day):
        self.row_number = row_number
        self.merchant = merchant
        self.description = description
        self.category = category
        self.amount = amount
        self.date = date(2026, 8, day)


def test_detects_repeated_merchant_similar_amount():
    rows = [
        _Row(1, "Netflix", "NETFLIX SUBSCRIPTION", "subscriptions", Decimal("649.00"), 5),
        _Row(2, "Netflix", "NETFLIX SUBSCRIPTION", "subscriptions", Decimal("649.00"), 20),
        _Row(3, "Swiggy", "SWIGGY ORDER", "food", Decimal("450.00"), 10),
    ]
    assert detect_recurring(rows) == {1, 2}


def test_tolerates_small_amount_variation():
    rows = [
        _Row(1, "Rent", "RENT PAYMENT", "housing", Decimal("18000.00"), 1),
        _Row(2, "Rent", "RENT PAYMENT", "housing", Decimal("18500.00"), 1),
    ]
    assert detect_recurring(rows) == {1, 2}


def test_single_occurrence_not_recurring():
    rows = [_Row(1, "Amazon", "AMAZON ORDER", "shopping", Decimal("2100.00"), 7)]
    assert detect_recurring(rows) == set()


def test_different_merchants_not_grouped():
    rows = [
        _Row(1, "Uber", "UBER RIDE", "transport", Decimal("180.00"), 1),
        _Row(2, "Ola", "OLA RIDE", "transport", Decimal("180.00"), 2),
    ]
    assert detect_recurring(rows) == set()
