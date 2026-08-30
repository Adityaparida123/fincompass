"""Integration tests for the financial health endpoint and persistence."""

from datetime import date
from decimal import Decimal

from app.db.enums import ConsentType, TransactionType
from app.db.mongo import Doc, MongoDatabase
from app.schemas.transaction import TransactionCreate
from app.services.finance.transactions import create_transaction


async def _create_user(db: MongoDatabase, email: str = "health-test@example.com") -> Doc:
    return await db.insert(
        "users",
        {"email": email, "password_hash": "hash", "full_name": "Health Test"},
    )


async def _seed_transactions(db: MongoDatabase, user_id: int, months: int = 3):
    today = date.today()
    year, month = today.year, today.month
    for _ in range(months):
        tx_date = date(year, month, 15)
        await create_transaction(
            db,
            user_id,
            TransactionCreate(
                date=tx_date,
                description="Sales income",
                amount=Decimal("60000"),
                currency="INR",
                transaction_type=TransactionType.income,
                category="sales",
            ),
        )
        await create_transaction(
            db,
            user_id,
            TransactionCreate(
                date=tx_date,
                description="Stock purchase",
                amount=Decimal("30000"),
                currency="INR",
                transaction_type=TransactionType.expense,
                category="inventory",
            ),
        )
        await create_transaction(
            db,
            user_id,
            TransactionCreate(
                date=tx_date,
                description="Shop rent",
                amount=Decimal("9000"),
                currency="INR",
                transaction_type=TransactionType.expense,
                category="rent",
            ),
        )
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1


async def test_denied_when_consent_revoked(client, auth_headers):
    from app.db.enums import ConsentStatus
    from app.db.mongo import get_database

    db = get_database()
    user = await db.find_one("users", {"email": "test@example.com"})
    assert user is not None

    await db.update_one(
        "consents",
        {"user_id": user.id, "consent_type": ConsentType.financial_data_analysis.value},
        {"status": ConsentStatus.revoked.value},
    )

    response = await client.get("/api/v1/financial-health", headers=auth_headers)
    assert response.status_code == 403


async def test_returns_score_with_five_factors(client, consented_headers):
    response = await client.get("/api/v1/financial-health", headers=consented_headers)
    assert response.status_code == 200
    payload = response.json()
    assert 0 <= payload["score"] <= 100
    assert payload["is_credit_score"] is False
    assert len(payload["factors"]) == 5
    assert payload["version"]


async def test_reflects_actual_transactions(client, consented_headers, db_session):
    user = await db_session.find_one("users", {"email": "test@example.com"})
    assert user is not None
    await _seed_transactions(db_session, user.id)

    response = await client.get("/api/v1/financial-health", headers=consented_headers)
    payload = response.json()
    assert payload["insufficient_data"] is False
    assert payload["score"] >= 50
    names = {f["name"] for f in payload["factors"]}
    assert names == {"cash_flow", "expense_control", "savings", "debt", "stability"}


async def test_persists_and_tracks_previous_score(client, consented_headers, db_session):
    await client.get("/api/v1/financial-health", headers=consented_headers)
    await client.get("/api/v1/financial-health", headers=consented_headers)

    rows = await db_session.find("financial_health_scores", {"user_id": 1})
    assert len(rows) >= 2
    assert rows[-1].score is not None

    response = await client.get("/api/v1/financial-health", headers=consented_headers)
    payload = response.json()
    assert payload["previous_score"] is not None
    assert payload["change"] is not None
