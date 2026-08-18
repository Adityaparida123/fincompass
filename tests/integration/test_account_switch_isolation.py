"""Account-switch security and data isolation end-to-end integration test."""

import pytest


async def _register(client, email: str, name: str) -> tuple[dict, int]:
    res = await client.post(
        "/api/v1/auth/register",
        json={"full_name": name, "email": email, "password": "super-secret-pass-123"},
    )
    assert res.status_code == 201
    data = res.json()
    user_id = data["user"]["id"]
    token = data["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


async def _login(client, email: str) -> tuple[dict, int]:
    res = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "super-secret-pass-123", "remember_me": False},
    )
    assert res.status_code == 200
    data = res.json()
    user_id = data["user"]["id"]
    token = data["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


@pytest.mark.asyncio
async def test_account_switch_isolation_full_flow(client):
    # Step 1: Create and login User A
    user_a_headers, user_a_id = await _register(client, "user_a_isolation@example.com", "User A")

    # Step 2: Add distinctive transactions to User A
    tx1_res = await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-01",
            "description": "USER_A_UNIQUE_EXPENSE_123",
            "amount": 1234.56,
            "currency": "INR",
            "transaction_type": "expense",
            "category": "shopping",
        },
        headers=user_a_headers,
    )
    assert tx1_res.status_code == 201
    tx1_id = tx1_res.json()["id"]

    tx2_res = await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-02",
            "description": "USER_A_UNIQUE_INCOME_456",
            "amount": 5678.90,
            "currency": "INR",
            "transaction_type": "income",
            "category": "salary",
        },
        headers=user_a_headers,
    )
    assert tx2_res.status_code == 201

    # Create budget, goal, and debt for User A
    budget_a = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "shopping", "limit_amount": 5000},
        headers=user_a_headers,
    )
    assert budget_a.status_code == 201

    goal_a = await client.post(
        "/api/v1/savings/goals",
        json={"name": "User A Car", "target_amount": 500000, "current_amount": 10000},
        headers=user_a_headers,
    )
    assert goal_a.status_code == 201

    # Step 3: Verify User A can retrieve User A data
    txs_a = await client.get("/api/v1/transactions", headers=user_a_headers)
    assert txs_a.status_code == 200
    descriptions_a = [t["description"] for t in txs_a.json()["items"]]
    assert "USER_A_UNIQUE_EXPENSE_123" in descriptions_a
    assert "USER_A_UNIQUE_INCOME_456" in descriptions_a

    # Step 4: Logout User A
    logout_a = await client.post("/api/v1/auth/logout", headers=user_a_headers)
    assert logout_a.status_code in (200, 204)

    # Step 5: Create and login User B
    user_b_headers, user_b_id = await _register(client, "user_b_isolation@example.com", "User B")
    assert user_b_id != user_a_id

    # Step 6 & 7: Verify User B has zero User A transactions initially
    txs_b = await client.get("/api/v1/transactions", headers=user_b_headers)
    assert txs_b.status_code == 200
    items_b = txs_b.json()["items"]
    assert len(items_b) == 0

    # Step 8: Verify User B cannot access User A transaction directly by ID
    tx_a_by_b = await client.get(f"/api/v1/transactions/{tx1_id}", headers=user_b_headers)
    assert tx_a_by_b.status_code == 404

    # Step 9: Verify all User B endpoints return ONLY User B data
    monthly_b = await client.get("/api/v1/expenses/monthly?period=2026-08", headers=user_b_headers)
    assert monthly_b.status_code == 200
    assert monthly_b.json()["transaction_count"] == 0

    trends_b = await client.get("/api/v1/expenses/trends?months=6", headers=user_b_headers)
    assert trends_b.status_code == 200

    budgets_b = await client.get("/api/v1/budget", headers=user_b_headers)
    assert budgets_b.status_code == 200
    assert len(budgets_b.json()) == 0

    savings_b = await client.get("/api/v1/savings/goals", headers=user_b_headers)
    assert savings_b.status_code == 200
    assert len(savings_b.json()) == 0

    debt_b = await client.get("/api/v1/debt", headers=user_b_headers)
    assert debt_b.status_code == 200
    assert len(debt_b.json()) == 0

    readiness_b = await client.get("/api/v1/credit-readiness", headers=user_b_headers)
    assert readiness_b.status_code == 200

    recs_b = await client.get("/api/v1/recommendations", headers=user_b_headers)
    assert recs_b.status_code == 200

    ml_b = await client.get("/api/v1/ml/cashflow-forecast", headers=user_b_headers)
    assert ml_b.status_code == 200

    notifs_b = await client.get("/api/v1/notifications", headers=user_b_headers)
    assert notifs_b.status_code == 200

    # Step 10: Logout User B
    logout_b = await client.post("/api/v1/auth/logout", headers=user_b_headers)
    assert logout_b.status_code in (200, 204)

    # Step 11: Login User A again
    user_a_reauth, _ = await _login(client, "user_a_isolation@example.com")

    # Step 12: Verify User A's original data is still present and intact
    txs_a_again = await client.get("/api/v1/transactions", headers=user_a_reauth)
    assert txs_a_again.status_code == 200
    descs = [t["description"] for t in txs_a_again.json()["items"]]
    assert "USER_A_UNIQUE_EXPENSE_123" in descs
    assert "USER_A_UNIQUE_INCOME_456" in descs
