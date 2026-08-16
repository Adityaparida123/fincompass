"""Unit tests for movement-type classification."""

from app.services.import_statement.movement import classify_movement


def test_cash_withdrawal():
    m, review = classify_movement("ATM Cash Withdrawal SBI", "expense", "other")
    assert m == "cash_withdrawal"
    assert not review


def test_cash_deposit():
    m, review = classify_movement("CASH DEPOSIT", "income", "income")
    assert m == "cash_deposit"
    assert not review


def test_refund():
    m, review = classify_movement("REFUND FROM AMAZON", "income", "income")
    assert m == "refund"
    assert not review


def test_interest():
    m, review = classify_movement("INTEREST CREDITED SAVINGS", "income", "income")
    assert m == "interest"
    assert not review


def test_fee_plural_forms():
    for desc in ("BANK CHARGES FOR OCT", "SERVICE CHARGE", "LATE FEE PAYMENT", "ANNUAL FEE"):
        m, _ = classify_movement(desc, "expense", "other")
        assert m == "fee", desc


def test_own_account_transfer():
    m, review = classify_movement("TRANSFER TO OWN ACCOUNT", "expense", "other")
    assert m == "transfer"
    assert not review


def test_credit_card_payment_is_transfer_not_spending():
    m, review = classify_movement("HDFC CREDIT CARD PAYMENT", "expense", "debt_payment")
    assert m == "transfer"
    assert not review


def test_income_via_neft_is_income_not_transfer():
    m, review = classify_movement("NEFT SALARY ABC PVT LTD", "income", "income")
    assert m == "income"
    assert not review


def test_transfer_out_without_category_flags_review():
    m, review = classify_movement("IMPS TO VENDOR", "expense", "other")
    assert m == "transfer"
    assert review


def test_bill_paid_via_transfer_is_spending():
    m, review = classify_movement("NEFT RENT PAYMENT", "expense", "housing")
    assert m == "expense"
    assert not review


def test_plain_expense():
    m, review = classify_movement("UPI DR SWIGGY", "expense", "food")
    assert m == "expense"
    assert not review
