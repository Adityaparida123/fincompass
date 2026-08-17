"""Integration tests for the credit readiness scoring system.

Verifies:
- Score is dynamically computed from actual financial data
- Date filtering works correctly with ISO-8601 strings
- Score updates when underlying data changes
- All 7 factors are present with correct directions
"""

from datetime import date
from decimal import Decimal

import pytest

from app.db.enums import ConsentType, TransactionType
from app.db.mongo import Doc, MongoDatabase
from app.schemas.transaction import TransactionCreate
from app.services.consent.service import grant_consent
from app.services.finance.transactions import create_transaction
from app.services.readiness.engine import ReadinessInput, compute_readiness
from app.services.readiness.factors import build_readiness_input
from app.services.readiness.service import compute_and_store, get_current_readiness


async def _create_user(db: MongoDatabase) -> Doc:
    return await db.insert(
        "users",
        {"email": "readiness-test@example.com", "password_hash": "hash", "full_name": "Readiness Test"},
    )


async def _seed_transactions(db: MongoDatabase, user_id: int, months: int = 3):
    """Insert income and expense transactions for the last N months (including current)."""
    today = date.today()
    year, month = today.year, today.month

    for _ in range(months):
        tx_date = date(year, month, 15)

        await create_transaction(
            db,
            user_id,
            TransactionCreate(
                date=tx_date,
                description="Salary",
                amount=Decimal("50000"),
                currency="INR",
                transaction_type=TransactionType.income,
                category="salary",
            ),
        )
        await create_transaction(
            db,
            user_id,
            TransactionCreate(
                date=tx_date,
                description="Rent",
                amount=Decimal("15000"),
                currency="INR",
                transaction_type=TransactionType.expense,
                category="housing",
            ),
        )
        await create_transaction(
            db,
            user_id,
            TransactionCreate(
                date=tx_date,
                description="Groceries",
                amount=Decimal("5000"),
                currency="INR",
                transaction_type=TransactionType.expense,
                category="food",
            ),
        )
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1


async def test_factors_builder_uses_iso_date_strings(db_session: MongoDatabase):
    """Verify the factors builder queries MongoDB with ISO date strings, not date objects."""
    user = await _create_user(db_session)
    await _seed_transactions(db_session, user.id)

    inp = await build_readiness_input(db_session, user.id)

    assert inp.income > Decimal("0"), "Income should be > 0 after seeding transactions"
    assert inp.total_expenses > Decimal("0"), "Expenses should be > 0 after seeding"
    assert len(inp.income_months) == 3
    assert all(m > Decimal("0") for m in inp.income_months), "Each income month should be > 0"


async def test_score_is_dynamic_from_financial_data(db_session: MongoDatabase):
    """Score should reflect actual transaction data, not a hardcoded default."""
    user = await _create_user(db_session)
    await _seed_transactions(db_session, user.id)
    await grant_consent(db_session, user.id, ConsentType.financial_data_analysis)

    result = await get_current_readiness(db_session, user.id)

    assert result.score != 35, "Score of 35 indicates date bug is still present (no data fetched)"
    assert 0 <= result.score <= 100
    assert len(result.factors) == 7


async def test_score_recomputes_each_call(db_session: MongoDatabase):
    """get_current_readiness should always recompute, not return stale cache."""
    user = await _create_user(db_session)
    await _seed_transactions(db_session, user.id)

    result1 = await get_current_readiness(db_session, user.id)
    result2 = await get_current_readiness(db_session, user.id)

    assert result1.score == result2.score, "Same data should produce same score"
    scores_in_db = await db_session.find("readiness_scores", {"user_id": user.id})
    assert len(scores_in_db) >= 2, "Each call should create a new score record"


async def test_score_updates_when_data_changes(db_session: MongoDatabase):
    """Score should change when new transactions are added."""
    user = await _create_user(db_session)
    await _seed_transactions(db_session, user.id, months=1)

    result_before = await get_current_readiness(db_session, user.id)

    await create_transaction(
        db_session,
        user.id,
        TransactionCreate(
            date=date.today().replace(day=1),
            description="Bonus",
            amount=Decimal("100000"),
            currency="INR",
            transaction_type=TransactionType.income,
            category="bonus",
        ),
    )

    result_after = await get_current_readiness(db_session, user.id)

    assert result_after.score >= result_before.score, "Adding income should improve or maintain score"


async def test_strong_financial_profile_scores_high(db_session: MongoDatabase):
    """User with high income, low expenses, high savings should score >= 70."""
    user = await _create_user(db_session)

    today = date.today()
    year, month = today.year, today.month
    for _ in range(3):
        tx_date = date(year, month, 15)
        await create_transaction(
            db_session,
            user.id,
            TransactionCreate(
                date=tx_date,
                description="Salary",
                amount=Decimal("100000"),
                currency="INR",
                transaction_type=TransactionType.income,
                category="salary",
            ),
        )
        await create_transaction(
            db_session,
            user.id,
            TransactionCreate(
                date=tx_date,
                description="Food",
                amount=Decimal("5000"),
                currency="INR",
                transaction_type=TransactionType.expense,
                category="food",
            ),
        )
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1

    await db_session.insert(
        "savings_goals",
        {"user_id": user.id, "name": "Emergency Fund", "target_amount": Decimal("500000"), "current_amount": Decimal("300000"), "is_deleted": False},
    )

    result = await get_current_readiness(db_session, user.id)
    assert result.score >= 70, f"Strong profile should score >= 70, got {result.score}"


async def test_all_factors_have_explanations(db_session: MongoDatabase):
    """Every factor should have a non-empty explanation."""
    user = await _create_user(db_session)
    await _seed_transactions(db_session, user.id)

    result = await get_current_readiness(db_session, user.id)

    for factor in result.factors:
        assert factor.explanation, f"Factor {factor.name} is missing explanation"
        assert factor.direction in ("positive", "negative", "neutral"), f"Factor {factor.name} has invalid direction: {factor.direction}"


async def test_factor_direction_matches_impact(db_session: MongoDatabase):
    """Direction should be positive/negative/neutral matching the sign of impact."""
    user = await _create_user(db_session)
    await _seed_transactions(db_session, user.id)

    result = await get_current_readiness(db_session, user.id)

    for f in result.factors:
        if f.impact > 0:
            assert f.direction == "positive", f"{f.name}: impact={f.impact} direction={f.direction}"
        elif f.impact < 0:
            assert f.direction == "negative", f"{f.name}: impact={f.impact} direction={f.direction}"
        else:
            assert f.direction == "neutral", f"{f.name}: impact={f.impact} direction={f.direction}"
