"""Unit tests for budget CRUD, status calculations, and edge cases."""

from decimal import Decimal

import pytest

from app.db.enums import TransactionType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _insert_expense(db, user_id, amount, category, date_str="2026-08-05"):
    await db.insert(
        "transactions",
        {
            "user_id": user_id,
            "date": date_str,
            "description": f"{category} expense",
            "amount": Decimal(str(amount)),
            "currency": "INR",
            "transaction_type": TransactionType.expense.value,
            "category": category,
            "is_deleted": False,
            "created_at": None,
            "updated_at": None,
        },
    )


async def _insert_income(db, user_id, amount, category, date_str="2026-08-01"):
    await db.insert(
        "transactions",
        {
            "user_id": user_id,
            "date": date_str,
            "description": f"{category} income",
            "amount": Decimal(str(amount)),
            "currency": "INR",
            "transaction_type": TransactionType.income.value,
            "category": category,
            "is_deleted": False,
            "created_at": None,
            "updated_at": None,
        },
    )


# ---------------------------------------------------------------------------
# Basic CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_status_with_transactions(db_session, client, consented_headers):
    """Original test: basic create + status with transactions."""
    user_id = 1
    await _insert_expense(db_session, user_id, 2000, "groceries", "2026-08-01")
    await _insert_expense(db_session, user_id, 9000, "rent", "2026-08-10")

    response = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "groceries", "limit_amount": "3000"},
        headers=consented_headers,
    )
    assert response.status_code == 201

    status_response = await client.get(
        "/api/v1/budget/status?period=2026-08", headers=consented_headers
    )
    assert status_response.status_code == 200
    statuses = status_response.json()
    assert len(statuses) == 1
    assert Decimal(statuses[0]["spent"]) == Decimal("2000")
    assert Decimal(statuses[0]["remaining"]) == Decimal("1000")


@pytest.mark.asyncio
async def test_budget_create_and_list(db_session, client, consented_headers):
    """Create a budget and verify it appears in the list."""
    resp = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["category"] == "food"
    assert Decimal(data["limit_amount"]) == Decimal("10000")

    list_resp = await client.get(
        "/api/v1/budget?period=2026-08", headers=consented_headers
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["category"] == "food"


@pytest.mark.asyncio
async def test_budget_update_limit(db_session, client, consented_headers):
    """Update a budget's limit_amount."""
    create_resp = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )
    budget_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/budget/{budget_id}",
        json={"limit_amount": "15000"},
        headers=consented_headers,
    )
    assert patch_resp.status_code == 200
    assert Decimal(patch_resp.json()["limit_amount"]) == Decimal("15000")


@pytest.mark.asyncio
async def test_budget_delete(db_session, client, consented_headers):
    """Delete a budget and verify it is removed."""
    create_resp = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )
    budget_id = create_resp.json()["id"]

    del_resp = await client.delete(
        f"/api/v1/budget/{budget_id}", headers=consented_headers
    )
    assert del_resp.status_code == 200

    list_resp = await client.get(
        "/api/v1/budget?period=2026-08", headers=consented_headers
    )
    assert list_resp.json() == []


# ---------------------------------------------------------------------------
# Duplicate prevention
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_duplicate_rejected(db_session, client, consented_headers):
    """Creating two budgets for the same user+period+category is rejected."""
    await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )
    resp = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "12000"},
        headers=consented_headers,
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["error"]["message"]


@pytest.mark.asyncio
async def test_budget_same_category_different_period_allowed(db_session, client, consented_headers):
    """Same category in different periods is allowed."""
    r1 = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )
    assert r1.status_code == 201
    r2 = await client.post(
        "/api/v1/budget",
        json={"period": "2026-09-01", "category": "food", "limit_amount": "12000"},
        headers=consented_headers,
    )
    assert r2.status_code == 201


# ---------------------------------------------------------------------------
# Over-budget calculation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_over_budget_status(db_session, client, consented_headers):
    """When spending exceeds the budget, remaining is negative and percent > 100."""
    user_id = 1
    await _insert_expense(db_session, user_id, 12500, "transport", "2026-08-05")

    await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "transport", "limit_amount": "10000"},
        headers=consented_headers,
    )

    resp = await client.get(
        "/api/v1/budget/status?period=2026-08", headers=consented_headers
    )
    assert resp.status_code == 200
    status = resp.json()[0]
    assert Decimal(status["spent"]) == Decimal("12500")
    assert Decimal(status["remaining"]) == Decimal("-2500")
    assert Decimal(status["percent_used"]) == Decimal("125.00")


@pytest.mark.asyncio
async def test_budget_exact_budget_status(db_session, client, consented_headers):
    """When spending exactly equals the budget, percent is 100."""
    user_id = 1
    await _insert_expense(db_session, user_id, 10000, "food", "2026-08-03")

    await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )

    resp = await client.get(
        "/api/v1/budget/status?period=2026-08", headers=consented_headers
    )
    status = resp.json()[0]
    assert Decimal(status["spent"]) == Decimal("10000")
    assert Decimal(status["remaining"]) == Decimal("0")
    assert Decimal(status["percent_used"]) == Decimal("100.00")


# ---------------------------------------------------------------------------
# Income excluded from spending
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_income_excluded_from_spending(db_session, client, consented_headers):
    """Income transactions must NOT count as spending."""
    user_id = 1
    await _insert_expense(db_session, user_id, 5000, "food", "2026-08-05")
    await _insert_income(db_session, user_id, 20000, "food", "2026-08-01")

    await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=consented_headers,
    )

    resp = await client.get(
        "/api/v1/budget/status?period=2026-08", headers=consented_headers
    )
    status = resp.json()[0]
    assert Decimal(status["spent"]) == Decimal("5000")
    assert Decimal(status["percent_used"]) == Decimal("50.00")


# ---------------------------------------------------------------------------
# Zero spending
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_zero_spending(db_session, client, consented_headers):
    """When no transactions exist, spent is 0 and percent is 0."""
    await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "shopping", "limit_amount": "8000"},
        headers=consented_headers,
    )

    resp = await client.get(
        "/api/v1/budget/status?period=2026-08", headers=consented_headers
    )
    status = resp.json()[0]
    assert Decimal(status["spent"]) == Decimal("0")
    assert Decimal(status["remaining"]) == Decimal("8000")
    assert Decimal(status["percent_used"]) == Decimal("0")


# ---------------------------------------------------------------------------
# Cross-user isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_cross_user_isolation(client, db_session):
    """Users cannot see each other's budgets."""
    # Register user 1
    r1 = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "User 1", "email": "user1@example.com", "password": "strong-password-123"},
    )
    assert r1.status_code == 201
    h1 = {"Authorization": f"Bearer {r1.json()['tokens']['access_token']}"}
    for ct in ["financial_data_analysis", "personalized_recommendations", "chat_financial_context"]:
        await client.post("/api/v1/consent", json={"consent_type": ct}, headers=h1)

    # Register user 2
    r2 = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "User 2", "email": "user2@example.com", "password": "strong-password-456"},
    )
    assert r2.status_code == 201
    h2 = {"Authorization": f"Bearer {r2.json()['tokens']['access_token']}"}
    for ct in ["financial_data_analysis", "personalized_recommendations", "chat_financial_context"]:
        await client.post("/api/v1/consent", json={"consent_type": ct}, headers=h2)

    # User 1 creates a budget
    create_resp = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": "10000"},
        headers=h1,
    )
    assert create_resp.status_code == 201
    budget_id = create_resp.json()["id"]

    # User 2 cannot see user 1's budgets
    list_resp = await client.get("/api/v1/budget?period=2026-08", headers=h2)
    assert list_resp.status_code == 200
    assert list_resp.json() == []

    # User 2 cannot update user 1's budget
    patch_resp = await client.patch(
        f"/api/v1/budget/{budget_id}",
        json={"limit_amount": "99999"},
        headers=h2,
    )
    assert patch_resp.status_code == 404

    # User 2 cannot delete user 1's budget
    del_resp = await client.delete(f"/api/v1/budget/{budget_id}", headers=h2)
    assert del_resp.status_code == 404


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_requires_consent(client, auth_headers):
    """Budget endpoints require financial_data_analysis consent."""
    await client.delete("/api/v1/consent/financial_data_analysis", headers=auth_headers)
    resp = await client.get(
        "/api/v1/budget/status?period=2026-08", headers=auth_headers
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_budget_unauthenticated_rejected(client):
    """Budget endpoints reject unauthenticated requests."""
    resp = await client.get("/api/v1/budget/status?period=2026-08")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Multiple categories
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_multiple_categories_status(db_session, client, consented_headers):
    """Multiple budgets in the same period each show correct spending."""
    user_id = 1
    await _insert_expense(db_session, user_id, 6200, "food", "2026-08-05")
    await _insert_expense(db_session, user_id, 18500, "housing", "2026-08-01")
    await _insert_expense(db_session, user_id, 5800, "transport", "2026-08-10")
    await _insert_expense(db_session, user_id, 2000, "shopping", "2026-08-15")

    for cat, limit in [("food", "10000"), ("housing", "20000"), ("transport", "5000"), ("shopping", "8000")]:
        await client.post(
            "/api/v1/budget",
            json={"period": "2026-08-01", "category": cat, "limit_amount": limit},
            headers=consented_headers,
        )

    resp = await client.get(
        "/api/v1/budget/status?period=2026-08", headers=consented_headers
    )
    assert resp.status_code == 200
    statuses = {s["category"]: s for s in resp.json()}

    # Food: 62%
    assert Decimal(statuses["food"]["spent"]) == Decimal("6200")
    assert Decimal(statuses["food"]["percent_used"]) == Decimal("62.00")
    assert Decimal(statuses["food"]["remaining"]) == Decimal("3800")

    # Housing: 92.5%
    assert Decimal(statuses["housing"]["spent"]) == Decimal("18500")
    assert Decimal(statuses["housing"]["percent_used"]) == Decimal("92.50")
    assert Decimal(statuses["housing"]["remaining"]) == Decimal("1500")

    # Transport: 116% (over budget)
    assert Decimal(statuses["transport"]["spent"]) == Decimal("5800")
    assert Decimal(statuses["transport"]["percent_used"]) == Decimal("116.00")
    assert Decimal(statuses["transport"]["remaining"]) == Decimal("-800")

    # Shopping: 25%
    assert Decimal(statuses["shopping"]["spent"]) == Decimal("2000")
    assert Decimal(statuses["shopping"]["percent_used"]) == Decimal("25.00")
    assert Decimal(statuses["shopping"]["remaining"]) == Decimal("6000")
