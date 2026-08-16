"""Unit tests for statement categorization (keyword rules + ML fallback)."""

from decimal import Decimal

import pytest

from app.services.import_statement.categorize import categorize_row, confidence_tier


@pytest.mark.asyncio
async def test_keyword_food():
    result = await categorize_row("SWIGGY order #1234", Decimal("350.00"), "expense")
    assert result.category == "food"
    assert result.source == "keyword"
    assert not result.needs_review


@pytest.mark.asyncio
async def test_keyword_salary():
    result = await categorize_row("Salary credit March", Decimal("45000.00"), "income")
    assert result.category == "income"
    assert result.source == "keyword"


@pytest.mark.asyncio
async def test_keyword_subscription_before_entertainment():
    result = await categorize_row("NETFLIX subscription", Decimal("649.00"), "expense")
    assert result.category == "subscriptions"


@pytest.mark.asyncio
async def test_keyword_debt_before_shopping():
    result = await categorize_row("HDFC credit card payment", Decimal("12000.00"), "expense")
    assert result.category == "debt_payment"


@pytest.mark.asyncio
async def test_income_defaults_to_income():
    result = await categorize_row("UPI CR XYX", Decimal("500.00"), "income")
    assert result.category == "income"


@pytest.mark.asyncio
async def test_unknown_falls_back_to_ml():
    result = await categorize_row("QR AB12CD34X random vendor", Decimal("120.00"), "expense")
    assert result.source == "ml"
    assert result.category in {"other", "shopping", "food", "groceries", "transport"}
    assert result.needs_review is True


def test_confidence_tiers():
    assert confidence_tier(1.0) == ("high", False)
    assert confidence_tier(0.96) == ("high", False)
    assert confidence_tier(0.90) == ("good", False)
    assert confidence_tier(0.80) == ("good", False)
    assert confidence_tier(0.75) == ("medium", True)
    assert confidence_tier(0.60) == ("medium", True)
    assert confidence_tier(0.40) == ("low", True)


@pytest.mark.asyncio
async def test_subcategory_assignment():
    assert (await categorize_row("RENT PAYMENT", Decimal("18000.00"), "expense")).subcategory == "rent"
    assert (await categorize_row("ELECTRICITY BILL", Decimal("1240.00"), "expense")).subcategory == "utility_bill"
    assert (await categorize_row("SWIGGY order", Decimal("450.00"), "expense")).subcategory == "restaurant"
    assert (await categorize_row("NETFLIX subscription", Decimal("649.00"), "expense")).subcategory == "streaming"
    assert (await categorize_row("MUTUAL FUND SIP", Decimal("2000.00"), "expense")).subcategory == "investment"


@pytest.mark.asyncio
async def test_ml_degraded_when_model_fails(monkeypatch):
    async def _boom(*args, **kwargs):
        raise FileNotFoundError("no model")

    monkeypatch.setattr("app.services.import_statement.categorize.categorize_transaction", _boom)
    result = await categorize_row("completely unknown vendor", Decimal("99.00"), "expense")
    assert result.source == "ml"
    assert result.category == "other"
    assert result.needs_review is True


@pytest.mark.asyncio
async def test_ml_result_confidence_tier(monkeypatch):
    async def _predict(description, amount, transaction_type):
        return {"prediction": {"value": "transport", "confidence": 0.72}}

    monkeypatch.setattr("app.services.import_statement.categorize.categorize_transaction", _predict)
    result = await categorize_row("RIDE TO AIRPORT", Decimal("600.00"), "expense")
    assert result.category == "transport"
    assert result.confidence == 0.72
    assert result.confidence_label == "medium"
    assert result.needs_review is True


@pytest.mark.asyncio
async def test_ml_result_good_confidence_not_reviewed(monkeypatch):
    async def _predict(description, amount, transaction_type):
        return {"prediction": {"value": "transport", "confidence": 0.92}}

    monkeypatch.setattr("app.services.import_statement.categorize.categorize_transaction", _predict)
    result = await categorize_row("TOLL TAX NHAI", Decimal("600.00"), "expense")
    assert result.confidence_label == "good"
    assert not result.needs_review


@pytest.mark.asyncio
async def test_ml_out_of_vocab_maps_to_other(monkeypatch):
    async def _predict(description, amount, transaction_type):
        return {"prediction": {"value": "lifestyle", "confidence": 0.90}}

    monkeypatch.setattr("app.services.import_statement.categorize.categorize_transaction", _predict)
    result = await categorize_row("random vendor", Decimal("50.00"), "expense")
    assert result.category == "other"
