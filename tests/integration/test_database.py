"""Database integrity and ownership tests."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.db.models.consent import Consent, ConsentStatus, ConsentType
from app.db.models.transaction import Transaction, TransactionType
from app.db.models.user import User
from app.services.consent.service import grant_consent, require_consent
from app.services.finance.transactions import create_transaction, get_transaction
from app.schemas.transaction import TransactionCreate


async def test_settings_support_sqlite_and_postgresql_urls():
    assert settings.database_backend in {"sqlite", "postgresql", "unknown"}


async def test_user_creation_persists(db_session):
    user = User(
        email="db-test@example.com",
        password_hash="hash",
        full_name="DB Test",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    assert user.id is not None


async def test_transaction_ownership_enforced(db_session):
    owner = User(email="owner@example.com", password_hash="hash", full_name="Owner")
    other = User(email="other@example.com", password_hash="hash", full_name="Other")
    db_session.add_all([owner, other])
    await db_session.flush()

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
    await db_session.commit()

    fetched = await get_transaction(db_session, owner.id, tx.id)
    assert fetched.user_id == owner.id

    with pytest.raises(Exception):
        await get_transaction(db_session, other.id, tx.id)


async def test_transaction_amount_is_decimal_not_float(db_session):
    user = User(email="decimal@example.com", password_hash="hash", full_name="Decimal")
    db_session.add(user)
    await db_session.flush()

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
    await db_session.commit()
    await db_session.refresh(tx)
    assert isinstance(tx.amount, Decimal)
    assert tx.amount == Decimal("45000.50")


async def test_consent_required_before_protected_access(db_session):
    user = User(email="consent@example.com", password_hash="hash", full_name="Consent")
    db_session.add(user)
    await db_session.flush()

    from app.core.exceptions import ConsentDeniedError

    with pytest.raises(ConsentDeniedError):
        await require_consent(db_session, user.id, ConsentType.financial_data_analysis)

    await grant_consent(db_session, user.id, ConsentType.financial_data_analysis)
    await db_session.commit()

    await require_consent(db_session, user.id, ConsentType.financial_data_analysis)
    stmt = select(Consent).where(Consent.user_id == user.id)
    consents = list((await db_session.execute(stmt)).scalars().all())
    assert len(consents) == 1
    assert consents[0].status == ConsentStatus.granted


async def test_soft_delete_excludes_from_active_queries(db_session):
    user = User(email="softdel@example.com", password_hash="hash", full_name="Soft Delete")
    db_session.add(user)
    await db_session.flush()

    from app.services.finance.transactions import soft_delete_transaction

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
    await db_session.commit()

    stmt = select(Transaction).where(
        Transaction.user_id == user.id,
        Transaction.is_deleted.is_(False),
    )
    active = list((await db_session.execute(stmt)).scalars().all())
    assert active == []


async def test_health_reports_database_backend(client):
    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"healthy", "degraded"}
    assert "database" in payload
    assert payload["database"]["backend"] in {"sqlite", "postgresql", "unknown"}
