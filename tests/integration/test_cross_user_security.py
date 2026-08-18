"""Cross-user read/write/delete/IDOR security and consent enforcement tests."""

import pytest


async def _user(client, email: str) -> tuple[dict, int]:
    res = await client.post(
        "/api/v1/auth/register",
        json={"full_name": email.split("@")[0], "email": email, "password": "pass-strong-1234"},
    )
    assert res.status_code == 201
    data = res.json()
    return {"Authorization": f"Bearer {data['tokens']['access_token']}"}, data["user"]["id"]


@pytest.mark.asyncio
async def test_cross_user_cannot_read_write_delete_resources(client):
    alice, alice_id = await _user(client, "alice_sec@example.com")
    bob, bob_id = await _user(client, "bob_sec@example.com")

    # Alice creates resources
    tx_res = await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-10",
            "description": "Alice Secret Tx",
            "amount": 9999,
            "currency": "INR",
            "transaction_type": "expense",
            "category": "shopping",
        },
        headers=alice,
    )
    assert tx_res.status_code == 201
    tx_id = tx_res.json()["id"]

    budget_res = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "shopping", "limit_amount": 10000},
        headers=alice,
    )
    assert budget_res.status_code == 201
    budget_id = budget_res.json()["id"]

    goal_res = await client.post(
        "/api/v1/savings/goals",
        json={"name": "Alice Goal", "target_amount": 50000, "current_amount": 5000},
        headers=alice,
    )
    assert goal_res.status_code == 201
    goal_id = goal_res.json()["id"]

    debt_res = await client.post(
        "/api/v1/debt",
        json={
            "name": "Alice Loan",
            "principal": 100000,
            "monthly_payment": 2000,
            "interest_rate": 8.5,
            "remaining_balance": 90000,
        },
        headers=alice,
    )
    assert debt_res.status_code == 201
    debt_id = debt_res.json()["id"]

    # Bob attempts GET on Alice's single-item resources -> 404
    assert (await client.get(f"/api/v1/transactions/{tx_id}", headers=bob)).status_code == 404
    assert (await client.patch(f"/api/v1/transactions/{tx_id}", json={"amount": 1}, headers=bob)).status_code == 404
    assert (await client.delete(f"/api/v1/transactions/{tx_id}", headers=bob)).status_code == 404

    assert (await client.patch(f"/api/v1/budget/{budget_id}", json={"limit_amount": 1}, headers=bob)).status_code == 404
    assert (await client.delete(f"/api/v1/budget/{budget_id}", headers=bob)).status_code == 404

    assert (await client.patch(f"/api/v1/savings/goals/{goal_id}", json={"current_amount": 1}, headers=bob)).status_code == 404
    assert (await client.delete(f"/api/v1/savings/goals/{goal_id}", headers=bob)).status_code == 404

    assert (await client.patch(f"/api/v1/debt/{debt_id}", json={"monthly_payment": 1}, headers=bob)).status_code == 404
    assert (await client.delete(f"/api/v1/debt/{debt_id}", headers=bob)).status_code == 404


@pytest.mark.asyncio
async def test_consent_revocation_enforces_403(client):
    alice, _ = await _user(client, "alice_consent@example.com")

    # Newly registered user has default consent granted and can call financial endpoints
    res1 = await client.get("/api/v1/expenses/monthly?period=2026-08", headers=alice)
    assert res1.status_code == 200

    # Alice revokes financial_data_analysis consent
    revoke_res = await client.delete("/api/v1/consent/financial_data_analysis", headers=alice)
    assert revoke_res.status_code == 200

    # Endpoint must now return 403 Forbidden
    res2 = await client.get("/api/v1/expenses/monthly?period=2026-08", headers=alice)
    assert res2.status_code == 403
    assert res2.json()["error"]["code"] == "CONSENT_DENIED"

    # Grant consent back
    grant_res = await client.post(
        "/api/v1/consent",
        json={"consent_type": "financial_data_analysis"},
        headers=alice,
    )
    assert grant_res.status_code in (200, 201)

    # Endpoint works again
    res3 = await client.get("/api/v1/expenses/monthly?period=2026-08", headers=alice)
    assert res3.status_code == 200


@pytest.mark.asyncio
async def test_recycle_bin_and_notifications_user_isolated(client):
    alice, _ = await _user(client, "alice_recycle@example.com")
    bob, _ = await _user(client, "bob_recycle@example.com")

    # Alice creates and deletes a transaction
    tx = (
        await client.post(
            "/api/v1/transactions",
            json={
                "date": "2026-08-11",
                "description": "Recycle Me",
                "amount": 500,
                "currency": "INR",
                "transaction_type": "expense",
                "category": "food",
            },
            headers=alice,
        )
    ).json()
    await client.delete(f"/api/v1/transactions/{tx['id']}", headers=alice)

    # Alice gets recycle bin items
    alice_bin = (await client.get("/api/v1/recycle-bin", headers=alice)).json()
    assert len(alice_bin) == 1
    item_id = alice_bin[0]["id"]

    # Bob lists recycle bin -> 0 items
    bob_bin = (await client.get("/api/v1/recycle-bin", headers=bob)).json()
    assert len(bob_bin) == 0

    # Bob attempts to restore or delete Alice's recycle bin item -> 404
    assert (await client.post(f"/api/v1/recycle-bin/{item_id}/restore", headers=bob)).status_code == 404
    assert (await client.delete(f"/api/v1/recycle-bin/{item_id}", headers=bob)).status_code == 404
