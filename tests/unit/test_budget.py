"""Unit tests for budget recommendation logic (uses actual transaction data)."""

from datetime import date
from decimal import Decimal

import pytest

from app.db.models.transaction import Transaction, TransactionType


@pytest.mark.asyncio
async def test_budget_status_with_transactions(db_session, client, consented_headers):
    user_id = 1
    db_session.add(
        Transaction(
            user_id=user_id,
            date=date(2026, 8, 5),
            description="Groceries",
            amount=Decimal("2000"),
            currency="INR",
            transaction_type=TransactionType.expense,
            category="groceries",
        )
    )
    db_session.add(
        Transaction(
            user_id=user_id,
            date=date(2026, 8, 10),
            description="Rent",
            amount=Decimal("9000"),
            currency="INR",
            transaction_type=TransactionType.expense,
            category="rent",
        )
    )
    await db_session.commit()

    response = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "groceries", "limit_amount": "3000"},
        headers=consented_headers,
    )
    assert response.status_code == 201

    status_response = await client.get("/api/v1/budget/status?period=2026-08", headers=consented_headers)
    assert status_response.status_code == 200
    statuses = status_response.json()
    assert len(statuses) == 1
    assert Decimal(statuses[0]["spent"]) == Decimal("2000")
    assert Decimal(statuses[0]["remaining"]) == Decimal("1000")
