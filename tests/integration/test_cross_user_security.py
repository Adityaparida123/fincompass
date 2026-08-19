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


@pytest.mark.asyncio
async def test_backfill_consents_creates_missing_records(client, db_session):
    """backfill_consents creates consent records for users missing them, without
    overwriting revoked consents."""
    from app.db.enums import ConsentType, ConsentStatus
    from app.services.consent.service import backfill_consents

    # Register two users (registration auto-grants all consents)
    alice, alice_id = await _user(client, "alice_backfill@example.com")
    bob, bob_id = await _user(client, "bob_backfill@example.com")

    # Verify both have all consents after registration
    for ct in ConsentType:
        c = await db_session.find_one(
            "consents",
            {"user_id": alice_id, "consent_type": ct.value},
        )
        assert c is not None, f"alice missing consent {ct.value} after registration"

    # Simulate a pre-consent-system user: manually remove all of Bob's consents
    await db_session.delete_many("consents", {"user_id": bob_id})

    # Verify Bob has no consents now
    bobs_consents = await db_session.find("consents", {"user_id": bob_id})
    assert len(bobs_consents) == 0

    # Now revoke Alice's financial_data_analysis (simulating an explicit revocation)
    await db_session.update_one(
        "consents",
        {"user_id": alice_id, "consent_type": ConsentType.financial_data_analysis.value},
        {"status": ConsentStatus.revoked.value},
    )

    # Run backfill
    created = await backfill_consents(db_session)
    assert created >= 4  # Bob needs all 4

    # Verify Bob now has all 4 consents
    for ct in ConsentType:
        c = await db_session.find_one(
            "consents",
            {"user_id": bob_id, "consent_type": ct.value},
        )
        assert c is not None, f"backfill missed {ct.value} for bob"
        assert c.status == ConsentStatus.granted.value

    # Verify Alice's revoked consent was NOT overwritten
    alice_fd = await db_session.find_one(
        "consents",
        {"user_id": alice_id, "consent_type": ConsentType.financial_data_analysis.value},
    )
    assert alice_fd.status == ConsentStatus.revoked.value

    # Running backfill again should be idempotent (creates 0 new records)
    created2 = await backfill_consents(db_session)
    assert created2 == 0


@pytest.mark.asyncio
async def test_newly_registered_user_has_all_consents(client):
    """A newly registered user can access all financial endpoints without 403."""
    user, _ = await _user(client, "newuser_consents@example.com")

    endpoints = [
        "/api/v1/expenses/monthly?period=2026-08",
        "/api/v1/expenses/trends?months=6",
        "/api/v1/savings/goals",
        "/api/v1/budget/status?period=2026-08",
        "/api/v1/credit-readiness",
        "/api/v1/recommendations",
        "/api/v1/ml/cashflow-forecast",
        "/api/v1/ml/spending-patterns",
    ]
    for ep in endpoints:
        res = await client.get(ep, headers=user)
        assert res.status_code == 200, f"{ep} returned {res.status_code}: {res.json()}"


@pytest.mark.asyncio
async def test_revoked_consent_returns_403_and_restoring_works(client):
    """Revoking a consent type produces 403; re-granting restores access."""
    user, _ = await _user(client, "consent_roundtrip@example.com")

    # Confirm access works
    res = await client.get("/api/v1/budget/status?period=2026-08", headers=user)
    assert res.status_code == 200

    # Revoke
    await client.delete("/api/v1/consent/financial_data_analysis", headers=user)
    res2 = await client.get("/api/v1/budget/status?period=2026-08", headers=user)
    assert res2.status_code == 403
    assert res2.json()["error"]["code"] == "CONSENT_DENIED"

    # Restore
    await client.post("/api/v1/consent", json={"consent_type": "financial_data_analysis"}, headers=user)
    res3 = await client.get("/api/v1/budget/status?period=2026-08", headers=user)
    assert res3.status_code == 200


@pytest.mark.asyncio
async def test_second_user_cannot_see_first_users_data(client):
    """User isolation: second user sees none of the first user's data."""
    alice, alice_id = await _user(client, "alice_iso2@example.com")
    bob, bob_id = await _user(client, "bob_iso2@example.com")

    # Alice creates data across all financial domains
    await client.post(
        "/api/v1/transactions",
        json={"date": "2026-08-15", "description": "Alice private tx", "amount": 7777, "currency": "INR", "transaction_type": "expense", "category": "shopping"},
        headers=alice,
    )
    await client.post(
        "/api/v1/budget", json={"period": "2026-08-01", "category": "shopping", "limit_amount": 10000}, headers=alice,
    )
    await client.post(
        "/api/v1/savings/goals", json={"name": "Alice Private Goal", "target_amount": 50000, "current_amount": 5000}, headers=alice,
    )
    await client.post(
        "/api/v1/debt", json={"name": "Alice Loan", "principal": 100000, "monthly_payment": 2000, "interest_rate": 8.5, "remaining_balance": 90000}, headers=alice,
    )

    # Bob queries all endpoints — must see none of Alice's data
    assert (await client.get("/api/v1/transactions", headers=bob)).json()["total"] == 0
    assert len((await client.get("/api/v1/budget", headers=bob)).json()) == 0
    assert len((await client.get("/api/v1/savings/goals", headers=bob)).json()) == 0
    assert len((await client.get("/api/v1/debt", headers=bob)).json()) == 0
