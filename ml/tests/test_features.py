"""Tests for ML feature engineering."""

import pandas as pd

from ml.features.behavioral_features import detect_spending_patterns
from ml.features.cashflow_features import (
    cashflow_features,
    category_forecasts,
    category_monthly_expenses,
    monthly_cashflow,
)
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


def test_cashflow_features_single_month():
    """Single month should produce features (not empty dict)."""
    monthly = pd.DataFrame({
        "income": [50000],
        "expenses": [35000],
        "cashflow": [15000],
    })
    feats = cashflow_features(monthly)
    assert feats != {}
    assert feats["months_available"] == 1
    assert feats["mean_income"] == 50000
    assert feats["mean_expenses"] == 35000
    assert feats["std_cashflow"] == 0.0
    assert feats["trend"] == 0.0


def test_cashflow_features_empty():
    """Empty dataframe should return empty dict."""
    monthly = pd.DataFrame(columns=["income", "expenses", "cashflow"])
    feats = cashflow_features(monthly)
    assert feats == {}


def test_category_monthly_expenses():
    df = pd.DataFrame([
        {"date": "2026-01-15", "amount": 5000, "type": "expense", "category": "food"},
        {"date": "2026-01-20", "amount": 3000, "type": "expense", "category": "transport"},
        {"date": "2026-02-10", "amount": 6000, "type": "expense", "category": "food"},
        {"date": "2026-02-15", "amount": 2500, "type": "expense", "category": "transport"},
    ])
    cat_monthly = category_monthly_expenses(df)
    assert len(cat_monthly) == 4  # 2 categories x 2 months
    food = cat_monthly[cat_monthly["category"] == "food"]
    assert len(food) == 2


def test_category_forecasts():
    df = pd.DataFrame([
        {"date": "2026-01-15", "amount": 5000, "type": "expense", "category": "food"},
        {"date": "2026-01-20", "amount": 3000, "type": "expense", "category": "transport"},
        {"date": "2026-02-10", "amount": 6000, "type": "expense", "category": "food"},
        {"date": "2026-02-15", "amount": 2500, "type": "expense", "category": "transport"},
    ])
    forecasts = category_forecasts(df)
    assert len(forecasts) == 2
    for fc in forecasts:
        assert "category" in fc
        assert "predicted" in fc
        assert "lower" in fc
        assert "upper" in fc
        assert "months_of_data" in fc
        assert fc["lower"] <= fc["predicted"] <= fc["upper"]


def test_category_forecasts_empty():
    df = pd.DataFrame(columns=["date", "amount", "type", "category", "description"])
    forecasts = category_forecasts(df)
    assert forecasts == []


def test_category_forecasts_single_category():
    df = pd.DataFrame([
        {"date": "2026-01-15", "amount": 5000, "type": "expense", "category": "food"},
    ])
    forecasts = category_forecasts(df)
    assert len(forecasts) == 1
    assert forecasts[0]["category"] == "food"
    assert forecasts[0]["months_of_data"] == 1
    assert forecasts[0]["predicted"] == 5000


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
