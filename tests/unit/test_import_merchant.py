"""Unit tests for merchant/entity extraction from narrations."""

from app.services.import_statement.merchant import extract_merchant


def test_known_brand_lookup():
    assert extract_merchant("UPI/DR/450/SWIGGY/ABC123") == "Swiggy"
    assert extract_merchant("UPI-DR-1200-AMAZON-PAY") == "Amazon"
    assert extract_merchant("POS/UBER INDIA/XYZ") == "Uber"
    assert extract_merchant("REFUND FROM AMAZON") == "Amazon"


def test_atm_withdrawal():
    assert extract_merchant("ATM Cash Withdrawal SBI 0011") == "ATM"


def test_upi_peer_merchant():
    assert extract_merchant("UPI/CR/450/RAHUL SHARMA/XYZ") == "Rahul"


def test_neft_counterparty():
    merchant = extract_merchant("NEFT SALARY ABC PVT LTD")
    assert merchant is not None
    assert "ABC" in merchant
    assert "salary" not in merchant.lower()


def test_empty_and_blank():
    assert extract_merchant(None) is None
    assert extract_merchant("") is None
    assert extract_merchant("   ") is None


def test_generic_fallback():
    assert extract_merchant("POS GROCERY MART 001") is not None


def test_digit_only_tokens_are_noise():
    assert extract_merchant("UPI/DR/450/SWIGGY/ABC123") == "Swiggy"
