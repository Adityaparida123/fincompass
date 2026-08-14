"""Database integrity and ownership tests (MongoDB facade + mongomock)."""

from datetime import date
from decimal import Decimal

import pytest

from app.core.config import settings
from app.db.models.consent import ConsentStatus, ConsentType
from app.db.models.transaction import TransactionType
from app.services.consent.service import grant_consent, require_consent
from app.services.finance.transactions import (
    create_transaction,
    get_transaction,
    soft_delete_transaction,
)
from app.schemas.transaction import TransactionCreate


async def test_settings_support_mongodb_backend():
    assert settings.database_backend == "mongodb"


async def test_user_creation_persists(db_session):
    user = await db_session.insert(
        "users",
        {
            "email": "db-test@example.com",
            "password_hash": "hash",
            "full_name": "DB Test",
        },
    )
    assert user.id is not None
    fetched = await db_session.find_one("users", {"id": user.id})
    assert fetched.email == "db-test@example.com"


async def test_transaction_ownership_enforced(db_session):
    owner = await db_session.insert(
        "users",
        {"email": "owner@example.com", "password_hash": "hash", "full_name": "Owner"},
    )
    other = await db_session.insert(
        "users",
        {"email": "other@example.com", "password_hash": "hash", "full_name": "Other"},
    )

    tx = await create_transaction(
        db_session,
        owner.id,
        TransactionCreate(
            date=date.today(),
            description="Groceries",
            amount=Decimal("1500.00"),
            currency="INR",
            transaction_type=TransactionType.expense,
            category="food",
        ),
    )

    fetched = await get_transaction(db_session, owner.id, tx.id)
    assert fetched.user_id == owner.id

    with pytest.raises(Exception):
        await get_transaction(db_session, other.id, tx.id)


async def test_transaction_amount_is_decimal_not_float(db_session):
    user = await db_session.insert(
        "users",
        {"email": "decimal@example.com", "password_hash": "hash", "full_name": "Decimal"},
    )

    tx = await create_transaction(
        db_session,
        user.id,
        TransactionCreate(
            date=date.today(),
            description="Salary",
            amount=Decimal("45000.50"),
            currency="INR",
            transaction_type=TransactionType.income,
            category="salary",
        ),
    )
    assert isinstance(tx.amount, Decimal)
    assert tx.amount == Decimal("45000.50")

    stored = await db_session.find_one("transactions", {"id": tx.id})
    assert isinstance(stored.amount, Decimal)
    assert stored.amount == Decimal("45000.50")


async def test_consent_required_before_protected_access(db_session):
    user = await db_session.insert(
        "users",
        {"email": "consent@example.com", "password_hash": "hash", "full_name": "Consent"},
    )

    from app.core.exceptions import ConsentDeniedError

    with pytest.raises(ConsentDeniedError):
        await require_consent(db_session, user.id, ConsentType.financial_data_analysis)

    await grant_consent(db_session, user.id, ConsentType.financial_data_analysis)

    await require_consent(db_session, user.id, ConsentType.financial_data_analysis)
    consents = await db_session.find("consents", {"user_id": user.id})
    assert len(consents) == 1
    assert consents[0].status == ConsentStatus.granted.value


async def test_soft_delete_excludes_from_active_queries(db_session):
    user = await db_session.insert(
        "users",
        {"email": "softdel@example.com", "password_hash": "hash", "full_name": "Soft Delete"},
    )

    tx = await create_transaction(
        db_session,
        user.id,
        TransactionCreate(
            date=date.today(),
            description="Coffee",
            amount=Decimal("250.00"),
            currency="INR",
            transaction_type=TransactionType.expense,
            category="food",
        ),
    )
    await soft_delete_transaction(db_session, user.id, tx.id)

    active = await db_session.find(
        "transactions",
        {"user_id": user.id, "is_deleted": False},
    )
    assert active == []


async def test_health_reports_mongodb_backend(client):
    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"healthy", "degraded"}
    assert "database" in payload
    assert payload["database"]["backend"] == "mongodb"
