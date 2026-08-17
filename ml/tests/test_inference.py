"""Tests for ML inference pipeline — forecast, patterns, savings, and edge cases."""

import pandas as pd
import pytest

from ml.config import ARTIFACTS_DIR
from ml.inference.classifier import TransactionClassifier, save_correction
from ml.inference.forecast import CashflowForecaster
from ml.pipelines.inference_pipeline import InferencePipeline


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_transactions():
    """6 months of mixed income/expense data."""
    records = []
    for month in range(1, 7):
        records.append({
            "user_id": "test_user",
            "date": f"2026-{month:02d}-01",
            "amount": 50000,
            "type": "income",
            "category": "income",
            "description": "salary",
        })
        for cat, amt in [("food", 4500), ("groceries", 3500), ("shopping", 3000),
                         ("transport", 2000), ("housing", 12000)]:
            records.append({
                "user_id": "test_user",
                "date": f"2026-{month:02d}-15",
                "amount": amt * (1 + month * 0.02),
                "type": "expense",
                "category": cat,
                "description": f"{cat} expense",
            })
    return pd.DataFrame(records)


@pytest.fixture
def single_month_transactions():
    """Only 1 month of data — insufficient for ML forecast."""
    return pd.DataFrame([
        {"user_id": "u1", "date": "2026-08-01", "amount": 50000, "type": "income", "category": "income", "description": "salary"},
        {"user_id": "u1", "date": "2026-08-05", "amount": 4500, "type": "expense", "category": "food", "description": "groceries"},
        {"user_id": "u1", "date": "2026-08-10", "amount": 12000, "type": "expense", "category": "housing", "description": "rent"},
    ])


@pytest.fixture
def two_month_transactions():
    """2 months of data — insufficient for ML, but sufficient for baseline."""
    records = []
    for month in [7, 8]:
        records.append({"user_id": "u1", "date": f"2026-{month:02d}-01", "amount": 50000, "type": "income", "category": "income", "description": "salary"})
        records.append({"user_id": "u1", "date": f"2026-{month:02d}-05", "amount": 4500, "type": "expense", "category": "food", "description": "food"})
        records.append({"user_id": "u1", "date": f"2026-{month:02d}-10", "amount": 12000, "type": "expense", "category": "housing", "description": "rent"})
    return pd.DataFrame(records)


@pytest.fixture
def empty_transactions():
    return pd.DataFrame(columns=["user_id", "date", "amount", "type", "category", "description"])


@pytest.fixture
def trained_models():
    model_path = ARTIFACTS_DIR / "transaction_classifier.joblib"
    if not model_path.exists():
        pytest.skip("Models not trained. Run: python -m ml.pipelines.training_pipeline")
    return True


# ---------------------------------------------------------------------------
# Forecast: sufficient data (ML model)
# ---------------------------------------------------------------------------

def test_forecast_with_sufficient_data(sample_transactions, trained_models):
    """6 months of data should produce an ML forecast."""
    fc = CashflowForecaster()
    result = fc.forecast(sample_transactions)
    assert result["status"] == "success"
    assert result["method"] == "ml_model"
    assert len(result["forecasts"]) == 1
    assert result["forecasts"][0]["expected_cashflow"] != 0
    assert result["prediction"]["confidence"] > 0
    assert len(result["explanation"]) >= 2


# ---------------------------------------------------------------------------
# Forecast: baseline fallback (limited data)
# ---------------------------------------------------------------------------

def test_forecast_baseline_with_two_months(two_month_transactions, trained_models):
    """2 months of data should use rolling baseline, not ML model."""
    fc = CashflowForecaster()
    result = fc.forecast(two_month_transactions)
    assert result["status"] == "success"
    assert result["method"] == "rolling_baseline"
    assert len(result["forecasts"]) == 1
    assert result["prediction"]["confidence"] > 0
    # Explanation should mention baseline
    method_explanation = [e for e in result["explanation"] if e["factor"] == "method"]
    assert len(method_explanation) == 1
    assert "baseline" in method_explanation[0]["description"].lower()


# ---------------------------------------------------------------------------
# Forecast: insufficient data
# ---------------------------------------------------------------------------

def test_forecast_insufficient_data_single_month(single_month_transactions, trained_models):
    """1 month of data should return insufficient_data."""
    fc = CashflowForecaster()
    result = fc.forecast(single_month_transactions)
    assert result["status"] == "insufficient_data"
    assert result["method"] == "none"
    assert result["forecasts"] == []
    assert result["available_months"] == 1
    assert result["required_months"] == 3
    assert "Not enough" in result["message"]


def test_forecast_insufficient_data_empty(empty_transactions, trained_models):
    """Empty data should return insufficient_data."""
    fc = CashflowForecaster()
    result = fc.forecast(empty_transactions)
    assert result["status"] == "insufficient_data"
    assert result["forecasts"] == []
    assert result["available_months"] == 0


# ---------------------------------------------------------------------------
# Forecast: income-only data
# ---------------------------------------------------------------------------

def test_forecast_income_only(trained_models):
    """Only income transactions should still produce a forecast."""
    df = pd.DataFrame([
        {"user_id": "u1", "date": f"2026-{m:02d}-01", "amount": 50000, "type": "income", "category": "income", "description": "salary"}
        for m in range(1, 5)
    ])
    fc = CashflowForecaster()
    result = fc.forecast(df)
    assert result["status"] == "success"
    assert len(result["forecasts"]) == 1


# ---------------------------------------------------------------------------
# Forecast: expense-only data
# ---------------------------------------------------------------------------

def test_forecast_expense_only(trained_models):
    """Only expense transactions should still produce a forecast."""
    df = pd.DataFrame([
        {"user_id": "u1", "date": f"2026-{m:02d}-05", "amount": 5000, "type": "expense", "category": "food", "description": "food"}
        for m in range(1, 5)
    ])
    fc = CashflowForecaster()
    result = fc.forecast(df)
    assert result["status"] == "success"
    assert len(result["forecasts"]) == 1


# ---------------------------------------------------------------------------
# Forecast: response schema
# ---------------------------------------------------------------------------

def test_forecast_response_schema(sample_transactions, trained_models):
    """Forecast response should contain all required fields."""
    fc = CashflowForecaster()
    result = fc.forecast(sample_transactions)
    assert "status" in result
    assert "method" in result
    assert "prediction" in result
    assert "forecasts" in result
    assert "explanation" in result
    assert "model" in result
    assert "timestamp" in result
    assert "name" in result["model"]
    assert "version" in result["model"]


def test_insufficient_data_response_schema(single_month_transactions, trained_models):
    """Insufficient data response should contain all required fields."""
    fc = CashflowForecaster()
    result = fc.forecast(single_month_transactions)
    assert "status" in result
    assert "available_months" in result
    assert "required_months" in result
    assert "message" in result
    assert result["status"] == "insufficient_data"


# ---------------------------------------------------------------------------
# Pipeline integration
# ---------------------------------------------------------------------------

def test_classifier_predict(trained_models):
    clf = TransactionClassifier()
    result = clf.predict("restaurant dinner", 450.0, "expense")
    assert "prediction" in result
    assert result["prediction"]["value"] in [
        "food", "groceries", "transport", "housing", "utilities",
        "healthcare", "education", "shopping", "entertainment",
        "subscriptions", "debt_payment", "savings", "income", "other",
    ]
    assert 0 <= result["prediction"]["confidence"] <= 1


def test_classifier_low_confidence_needs_review(trained_models):
    clf = TransactionClassifier()
    result = clf.predict("misc payment", 10.0, "expense")
    assert "needs_review" in result["prediction"]


def test_category_correction():
    record = save_correction("tx_1", "food", "shopping", "user_1")
    assert record["original_prediction"] == "food"
    assert record["corrected_category"] == "shopping"


def test_inference_pipeline_patterns(sample_transactions, trained_models):
    pipeline = InferencePipeline()
    result = pipeline.detect_patterns("test_user", sample_transactions)
    assert "patterns" in result
    assert result["model"]["name"] == "spending_patterns"


def test_cache_invalidation(sample_transactions, trained_models):
    pipeline = InferencePipeline()
    pipeline.forecast_cashflow("test_user", sample_transactions)
    pipeline.invalidate_cache("test_user")
    assert pipeline._cache_key("test_user", "forecast") not in pipeline._cache


def test_recalculate_after_correction(sample_transactions, trained_models):
    pipeline = InferencePipeline()
    result = pipeline.recalculate_after_correction("test_user", sample_transactions)
    assert "forecast" in result
    assert "savings" in result
    assert "patterns" in result


def test_forecast_pipeline_insufficient_data(single_month_transactions, trained_models):
    """Pipeline should handle insufficient data gracefully."""
    pipeline = InferencePipeline()
    result = pipeline.forecast_cashflow("test_user", single_month_transactions)
    assert result["status"] == "insufficient_data"
    assert result["forecasts"] == []


def test_forecast_pipeline_baseline(single_month_transactions, trained_models):
    """Pipeline should cache insufficient data results."""
    pipeline = InferencePipeline()
    result1 = pipeline.forecast_cashflow("test_user", single_month_transactions)
    result2 = pipeline.forecast_cashflow("test_user", single_month_transactions)
    assert result1 is result2  # cached
