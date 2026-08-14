"""Integration tests for ML API endpoints."""

import pytest

from ml.config import ARTIFACTS_DIR


@pytest.fixture
def trained_models():
    if not (ARTIFACTS_DIR / "transaction_classifier.joblib").exists():
        pytest.skip("Models not trained. Run: python -m ml.pipelines.training_pipeline")


@pytest.mark.asyncio
async def test_ml_spending_patterns_requires_consent(client, auth_headers, trained_models):
    response = await client.get("/api/v1/ml/spending-patterns", headers=auth_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_ml_spending_patterns_with_consent(client, consented_headers, trained_models):
    response = await client.get("/api/v1/ml/spending-patterns", headers=consented_headers)
    assert response.status_code == 200
    payload = response.json()
    assert "patterns" in payload
    assert "model" in payload


@pytest.mark.asyncio
async def test_ml_categorize(client, consented_headers, trained_models):
    response = await client.post(
        "/api/v1/ml/categorize",
        headers=consented_headers,
        json={"description": "swiggy dinner order", "amount": "450.00", "transaction_type": "expense"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "category" in payload
    assert "needs_review" in payload
    assert payload["model"]["name"] == "transaction_classifier"


@pytest.mark.asyncio
async def test_ml_categorize_requires_auth(client, trained_models):
    response = await client.post(
        "/api/v1/ml/categorize",
        json={"description": "test", "amount": "100.00"},
    )
    assert response.status_code == 401
