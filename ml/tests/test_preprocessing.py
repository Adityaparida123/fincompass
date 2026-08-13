"""Tests for ML preprocessing and validation."""

import pandas as pd
import pytest

from ml.config import PROTECTED_CHARACTERISTICS
from ml.evaluation.fairness import audit_features, fairness_report
from ml.preprocessing.cleaning import clean_transactions
from ml.preprocessing.validation import (
    ValidationError,
    check_sufficient_data,
    validate_transaction_input,
)


def test_clean_transactions():
    df = pd.DataFrame([
        {"user_id": "u1", "date": "2026-01-01", "amount": 100, "type": "expense",
         "category": "FOOD", "description": "  Restaurant  "},
    ])
    cleaned = clean_transactions(df)
    assert cleaned.iloc[0]["category"] == "food"
    assert cleaned.iloc[0]["description"] == "restaurant"


def test_validate_transaction_input():
    validate_transaction_input({"description": "test", "amount": 100})
    with pytest.raises(ValidationError):
        validate_transaction_input({"description": "test"})


def test_protected_characteristics_excluded():
    audit = audit_features(["amount", "description", "day_of_week"])
    assert audit["passed"] is True

    audit_fail = audit_features(["amount", "gender", "religion"])
    assert audit_fail["passed"] is False
    assert "gender" in audit_fail["protected_violations"]


def test_insufficient_data():
    df = pd.DataFrame([{"date": pd.Timestamp("2026-01-01"), "amount": 100}])
    sufficient, msg = check_sufficient_data(df, "anomaly")
    assert sufficient is False
    assert "Not enough" in msg or "Need at least" in msg


def test_fairness_report():
    df = pd.DataFrame({"amount": [100, 200], "description": ["a", "b"]})
    report = fairness_report(df)
    assert report["feature_audit"]["passed"] is True
