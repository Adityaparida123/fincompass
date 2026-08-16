"""Unit tests for statement amount/date normalization."""

from datetime import date
from decimal import Decimal

from app.services.import_statement.normalize import (
    clean_description,
    parse_amount,
    parse_date,
)


def test_parse_amount_indian_format():
    assert parse_amount("1,23,456.78") == Decimal("123456.78")


def test_parse_amount_western_format():
    assert parse_amount("1,234.56") == Decimal("1234.56")


def test_parse_amount_european_format():
    assert parse_amount("1.234,56") == Decimal("1234.56")
    assert parse_amount("1234,56") == Decimal("1234.56")


def test_parse_amount_plain_and_currency():
    assert parse_amount("₹1,200.50") == Decimal("1200.50")
    assert parse_amount("INR 500") == Decimal("500.00")
    assert parse_amount("5,000") == Decimal("5000.00")


def test_parse_amount_signs():
    assert parse_amount("-1,000") == Decimal("-1000.00")
    assert parse_amount("(1,000.00)") == Decimal("-1000.00")
    assert parse_amount("+250") == Decimal("250.00")


def test_parse_amount_dr_cr_flags():
    assert parse_amount("1,000.00 Dr") == Decimal("-1000.00")
    assert parse_amount("1,000.00 Cr") == Decimal("1000.00")
    assert parse_amount("250 DR") == Decimal("-250.00")
    assert parse_amount("250 CR") == Decimal("250.00")


def test_parse_amount_invalid():
    assert parse_amount("") is None
    assert parse_amount(None) is None
    assert parse_amount("N/A") is None
    assert parse_amount("0.00") is None


def test_parse_amount_rounding():
    assert parse_amount("99.999") == Decimal("100.00")


def test_parse_date_common_formats():
    assert parse_date("01/08/2026") == date(2026, 8, 1)
    assert parse_date("01-08-2026") == date(2026, 8, 1)
    assert parse_date("01.08.2026") == date(2026, 8, 1)
    assert parse_date("2026-08-01") == date(2026, 8, 1)
    assert parse_date("01 Aug 2026") == date(2026, 8, 1)
    assert parse_date("01 Aug. 2026") == date(2026, 8, 1)
    assert parse_date("Aug 01, 2026") == date(2026, 8, 1)


def test_parse_date_two_digit_year():
    assert parse_date("01/08/25") == date(2025, 8, 1)


def test_parse_date_invalid():
    assert parse_date("") is None
    assert parse_date("not-a-date") is None
    assert parse_date(None) is None


def test_clean_description():
    assert clean_description("  Zomato   order    #123  ") == "Zomato order #123"
    assert clean_description(None) == ""
