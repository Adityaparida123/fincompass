"""Integration tests for the account-deletion endpoint."""


async def test_delete_me_requires_auth(client):
    response = await client.delete("/api/v1/users/me")
    assert response.status_code == 401


async def test_delete_me_removes_account_and_data(client, consented_headers, db_session):
    me = await client.get("/api/v1/users/me", headers=consented_headers)
    assert me.status_code == 200
    user_id = me.json()["id"]

    created_tx = await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-05",
            "description": "Groceries",
            "amount": 1200,
            "transaction_type": "expense",
            "category": "food",
        },
        headers=consented_headers,
    )
    assert created_tx.status_code == 201

    created_budget = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-15", "category": "food", "limit_amount": "5000"},
        headers=consented_headers,
    )
    assert created_budget.status_code == 201

    created_goal = await client.post(
        "/api/v1/savings/goals",
        json={"name": "Emergency fund", "target_amount": "100000", "target_date": "2027-01-01"},
        headers=consented_headers,
    )
    assert created_goal.status_code == 201

    session = await db_session.insert("chat_sessions", {"user_id": user_id, "title": "s"})
    await db_session.insert("chat_messages", {"session_id": session.id, "role": "user"})
    score = await db_session.insert("readiness_scores", {"user_id": user_id})
    await db_session.insert("readiness_factors", {"readiness_score_id": score.id})

    assert (await db_session.count("chat_sessions", {"user_id": user_id})) == 1
    assert (await db_session.count("chat_messages", {"session_id": session.id})) == 1
    assert (await db_session.count("readiness_scores", {"user_id": user_id})) == 1

    response = await client.delete("/api/v1/users/me", headers=consented_headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Account deleted."

    assert (await db_session.find_one("users", {"id": user_id})) is None
    for collection in (
        "transactions",
        "budgets",
        "savings_goals",
        "consents",
        "refresh_token_sessions",
        "ml_predictions",
        "notifications",
        "recycle_bin",
        "audit_logs",
    ):
        assert await db_session.count(collection, {"user_id": user_id}) == 0, collection
    assert (await db_session.count("chat_sessions", {"user_id": user_id})) == 0
    assert (await db_session.count("chat_messages", {"session_id": session.id})) == 0
    assert (await db_session.count("readiness_scores", {"user_id": user_id})) == 0
    assert (await db_session.count("readiness_factors", {"readiness_score_id": score.id})) == 0

    stale = await client.get("/api/v1/users/me", headers=consented_headers)
    assert stale.status_code == 401
