"""Cross-user data isolation tests (IDOR prevention)."""


async def _register(client, email: str) -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Isolation", "email": email, "password": "super-secure-pass"},
    )
    assert response.status_code == 201
    token = response.json()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    consent = await client.post(
        "/api/v1/consent",
        json={"consent_type": "financial_data_analysis"},
        headers=headers,
    )
    assert consent.status_code in (200, 201)
    return headers


async def test_savings_goal_isolation(client):
    alice = await _register(client, "alice-iso@example.com")
    bob = await _register(client, "bob-iso@example.com")

    created = await client.post(
        "/api/v1/savings/goals",
        json={"name": "Trip", "target_amount": 50000, "current_amount": 1000},
        headers=alice,
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]

    bob_patch = await client.patch(
        f"/api/v1/savings/goals/{goal_id}", json={"current_amount": 999}, headers=bob
    )
    assert bob_patch.status_code == 404

    alice_patch = await client.patch(
        f"/api/v1/savings/goals/{goal_id}", json={"current_amount": 2000}, headers=alice
    )
    assert alice_patch.status_code == 200
    assert alice_patch.json()["current_amount"] == "2000.00"


async def test_transaction_isolation(client):
    alice = await _register(client, "alice-tx@example.com")
    bob = await _register(client, "bob-tx@example.com")

    created = await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-01-10",
            "description": "Groceries",
            "amount": 1500,
            "currency": "INR",
            "transaction_type": "expense",
            "category": "groceries",
        },
        headers=alice,
    )
    assert created.status_code == 201
    tx_id = created.json()["id"]

    bob_get = await client.get(f"/api/v1/transactions/{tx_id}", headers=bob)
    assert bob_get.status_code == 404

    bob_delete = await client.delete(f"/api/v1/transactions/{tx_id}", headers=bob)
    assert bob_delete.status_code == 404


async def test_budget_isolation(client):
    alice = await _register(client, "alice-bud@example.com")
    bob = await _register(client, "bob-bud@example.com")

    created = await client.post(
        "/api/v1/budget",
        json={"period": "2026-01-01", "category": "food", "limit_amount": 3000},
        headers=alice,
    )
    assert created.status_code == 201
    budget_id = created.json()["id"]

    bob_patch = await client.patch(
        f"/api/v1/budget/{budget_id}", json={"limit_amount": 9999}, headers=bob
    )
    assert bob_patch.status_code == 404

    alice_patch = await client.patch(
        f"/api/v1/budget/{budget_id}", json={"limit_amount": 4000}, headers=alice
    )
    assert alice_patch.status_code == 200
    assert alice_patch.json()["limit_amount"] == "4000.00"
