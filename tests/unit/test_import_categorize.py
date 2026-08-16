"""Unit tests for statement categorization (keyword rules + ML fallback)."""

from decimal import Decimal

import pytest

from app.services.import_statement.categorize import categorize_row


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
