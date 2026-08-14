"""Tests for ML inference pipeline."""

import pandas as pd
import pytest

from ml.config import ARTIFACTS_DIR
from ml.inference.classifier import TransactionClassifier, save_correction
from ml.pipelines.inference_pipeline import InferencePipeline


@pytest.fixture
def sample_transactions():
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
def trained_models():
    model_path = ARTIFACTS_DIR / "transaction_classifier.joblib"
    if not model_path.exists():
        pytest.skip("Models not trained. Run: python -m ml.pipelines.training_pipeline")
    return True


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
