"""Integration tests for the financial API surface."""

from decimal import Decimal


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"healthy", "degraded", "ok"}
    assert payload["service"] == "finai-backend"
    assert "database" in payload


async def test_emi_endpoint(client):
    response = await client.post(
        "/api/v1/tools/emi",
        json={"principal": 100000, "annual_interest_rate": 12, "tenure_months": 12},
    )
    assert response.status_code == 200
    assert response.json()["monthly_emi"] == "8884.88"
    assert response.json()["total_interest"] == "6618.56"


async def test_emi_validation(client):
    response = await client.post(
        "/api/v1/tools/emi",
        json={"principal": -100, "annual_interest_rate": 12, "tenure_months": 12},
    )
    assert response.status_code == 422


async def test_loan_simulation_endpoint(client):
    response = await client.post(
        "/api/v1/tools/loan-simulation",
        json={
            "income": 45000,
            "monthly_expenses": 29800,
            "existing_debt_payment": 5000,
            "loan_amount": 100000,
            "interest_rate": 12,
            "tenure_months": 12,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["emi"] == "8884.88"
    assert body["cash_flow_after"] == "1315.12"
    assert len(body["alternatives"]) >= 1


async def test_cashflow_endpoint(client):
    response = await client.post(
        "/api/v1/cashflow/calculate",
        json={
            "income": 45000,
            "essential_expenses": 20000,
            "discretionary_expenses": 5000,
            "debt_payments": 5000,
        },
    )
    assert response.status_code == 200
    assert response.json()["available_cash_flow"] == "15000.00"


async def test_transaction_crud(client, consented_headers):
    created = await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-05",
            "description": "Salary",
            "amount": 45000,
            "transaction_type": "income",
            "category": "salary",
        },
        headers=consented_headers,
    )
    assert created.status_code == 201
    tx_id = created.json()["id"]

    listed = await client.get("/api/v1/transactions", headers=consented_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    patched = await client.patch(
        f"/api/v1/transactions/{tx_id}",
        json={"description": "Monthly Salary"},
        headers=consented_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["description"] == "Monthly Salary"

    deleted = await client.delete(f"/api/v1/transactions/{tx_id}", headers=consented_headers)
    assert deleted.status_code == 200

    after = await client.get("/api/v1/transactions", headers=consented_headers)
    assert after.json()["total"] == 0


async def test_expense_analysis_requires_consent(client, auth_headers):
    await client.delete("/api/v1/consent/financial_data_analysis", headers=auth_headers)
    response = await client.get("/api/v1/expenses/monthly?period=2026-08", headers=auth_headers)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CONSENT_DENIED"


async def test_expenses_monthly(client, consented_headers):
    await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-05",
            "description": "Groceries",
            "amount": 6200,
            "transaction_type": "expense",
            "category": "food",
        },
        headers=consented_headers,
    )
    await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-10",
            "description": "Rent",
            "amount": 9000,
            "transaction_type": "expense",
            "category": "rent",
        },
        headers=consented_headers,
    )
    response = await client.get("/api/v1/expenses/monthly?period=2026-08", headers=consented_headers)
    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_expenses"]) == Decimal("15200")
    assert body["categories"]["food"] == "6200.00"
    assert body["categories"]["rent"] == "9000.00"


async def test_budget_flow(client, consented_headers):
    created = await client.post(
        "/api/v1/budget",
        json={"period": "2026-08-01", "category": "food", "limit_amount": 8000},
        headers=consented_headers,
    )
    assert created.status_code == 201
    budget_id = created.json()["id"]

    listed = await client.get("/api/v1/budget?period=2026-08", headers=consented_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    patched = await client.patch(
        f"/api/v1/budget/{budget_id}",
        json={"limit_amount": 7500},
        headers=consented_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["limit_amount"] == "7500.00"

    deleted = await client.delete(f"/api/v1/budget/{budget_id}", headers=consented_headers)
    assert deleted.status_code == 200


async def test_debt_burden_endpoint(client):
    response = await client.post(
        "/api/v1/debt/burden",
        json={"monthly_income": 45000, "monthly_debt_payments": 5000},
    )
    assert response.status_code == 200
    assert response.json()["debt_payment_ratio"] == "11.11"


async def test_readiness_and_correction(client, consented_headers):
    response = await client.get("/api/v1/credit-readiness", headers=consented_headers)
    assert response.status_code == 200
    first_score = response.json()["score"]

    corrected = await client.post(
        "/api/v1/credit-readiness/correct",
        json={
            "income": 50000,
            "total_expenses": 20000,
            "essential_monthly_expenses": 15000,
            "debt_payments": 1000,
            "savings": 200000,
            "reason": "Reported income and expenses were incorrect.",
        },
        headers=consented_headers,
    )
    assert corrected.status_code == 200
    body = corrected.json()
    assert body["previous_score"] == first_score
    assert body["updated_score"] != first_score
    assert body["reason"] == "Reported income and expenses were incorrect."
    assert len(body["changed_factors"]) >= 1


async def test_recommendations_prioritize_resilience(client, consented_headers):
    response = await client.get("/api/v1/recommendations", headers=consented_headers)
    assert response.status_code == 200
    types = [r["type"] for r in response.json()["recommendations"]]
    assert "emergency_fund" in types or "savings" in types


async def test_schemes_listing(client):
    response = await client.get("/api/v1/schemes")
    assert response.status_code == 200
    assert len(response.json()) > 0


async def test_schemes_match_marks_potential(client):
    response = await client.post(
        "/api/v1/schemes/match",
        json={"income": 20000, "age": 65},
    )
    assert response.status_code == 200
    body = response.json()
    for match in body["matches"]:
        assert match["confidence"] == "potential"
        assert "verify" in match["disclaimer"].lower()


async def test_consent_flow(client, auth_headers):
    granted = await client.post(
        "/api/v1/consent",
        json={"consent_type": "financial_data_analysis"},
        headers=auth_headers,
    )
    assert granted.status_code == 201

    listed = await client.get("/api/v1/consent", headers=auth_headers)
    assert listed.status_code == 200
    assert any(c["consent_type"] == "financial_data_analysis" for c in listed.json()["items"])

    revoked = await client.delete("/api/v1/consent/financial_data_analysis", headers=auth_headers)
    assert revoked.status_code == 200


async def test_recycle_bin_flow(client, consented_headers):
    created = await client.post(
        "/api/v1/transactions",
        json={
            "date": "2026-08-05",
            "description": "Test",
            "amount": 100,
            "transaction_type": "expense",
            "category": "other",
        },
        headers=consented_headers,
    )
    tx_id = created.json()["id"]
    await client.delete(f"/api/v1/transactions/{tx_id}", headers=consented_headers)

    items = await client.get("/api/v1/recycle-bin", headers=consented_headers)
    assert items.status_code == 200
    assert len(items.json()) == 1
    assert items.json()[0]["resource_type"] == "transaction"

    restored = await client.post("/api/v1/recycle-bin/1/restore", headers=consented_headers)
    assert restored.status_code == 200
