"""Tests for ML feature engineering."""

import pandas as pd

from ml.features.behavioral_features import detect_spending_patterns
from ml.features.cashflow_features import cashflow_features, monthly_cashflow
from ml.features.savings_features import savings_features


def test_monthly_cashflow():
    df = pd.DataFrame([
        {"date": "2026-01-15", "amount": 50000, "type": "income", "category": "income"},
        {"date": "2026-01-20", "amount": 5000, "type": "expense", "category": "food"},
        {"date": "2026-02-01", "amount": 50000, "type": "income", "category": "income"},
        {"date": "2026-02-10", "amount": 8000, "type": "expense", "category": "shopping"},
    ])
    monthly = monthly_cashflow(df)
    assert len(monthly) == 2
    assert monthly.iloc[0]["cashflow"] == 45000


def test_cashflow_features():
    monthly = pd.DataFrame({
        "income": [50000, 50000, 52000],
        "expenses": [35000, 36000, 38000],
        "cashflow": [15000, 14000, 14000],
    })
    feats = cashflow_features(monthly)
    assert "mean_cashflow" in feats
    assert feats["mean_income"] > 0


def test_savings_features():
    monthly = pd.DataFrame({
        "income": [50000, 50000],
        "expenses": [36000, 37000],
        "cashflow": [14000, 13000],
    })
    feats = savings_features(monthly, debt_payment=6000)
    assert feats["debt_obligations"] == 6000
    assert feats["net_after_debt"] > 0


def test_spending_patterns_detects_increase():
    records = []
    for month in range(1, 4):
        for day in range(1, 15):
            amount = 500 if month < 3 else 800
            records.append({
                "date": f"2026-{month:02d}-{day:02d}",
                "amount": amount,
                "type": "expense",
                "category": "food",
                "description": "restaurant",
            })
    df = pd.DataFrame(records)
    patterns = detect_spending_patterns(df)
    assert any("food" in p.get("pattern", "") for p in patterns)
