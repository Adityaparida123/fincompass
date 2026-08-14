"""Fairness tests for the ML feature pipeline."""

import pandas as pd

from ml.config import PROTECTED_CHARACTERISTICS, TRANSACTION_CATEGORIES
from ml.evaluation.fairness import audit_features, fairness_report
from ml.features.cashflow_features import cashflow_features, monthly_cashflow
from ml.features.savings_features import savings_features
from ml.features.transaction_features import compute_rolling_features


def test_protected_characteristics_not_in_category_list():
    for protected in PROTECTED_CHARACTERISTICS:
        assert protected not in TRANSACTION_CATEGORIES


def test_audit_features_rejects_protected_columns():
    report = audit_features(["amount", "category", "gender", "rolling_mean"])
    assert "gender" in report["protected_violations"]
    assert report["passed"] is False


def test_fairness_report_structure():
    df = pd.DataFrame({"amount": [1, 2], "religion": ["a", "b"]})
    report = fairness_report(df)
    assert report["feature_audit"]["passed"] is False


def test_engineered_feature_names_exclude_protected():
    df = pd.DataFrame([
        {"user_id": "1", "date": "2026-01-01", "amount": 100, "type": "expense", "category": "food"},
        {"user_id": "1", "date": "2026-01-02", "amount": 200, "type": "expense", "category": "food"},
        {"user_id": "1", "date": "2026-01-03", "amount": 300, "type": "income", "category": "income"},
    ])
    rolling = compute_rolling_features(df, "1")
    for col in rolling.columns:
        assert col.lower() not in PROTECTED_CHARACTERISTICS

    monthly = monthly_cashflow(df)
    cashflow = cashflow_features(monthly)
    for key in cashflow:
        assert key.lower() not in PROTECTED_CHARACTERISTICS

    savings = savings_features(monthly, debt_payment=1000, current_savings=5000)
    for key in savings:
        assert key.lower() not in PROTECTED_CHARACTERISTICS
