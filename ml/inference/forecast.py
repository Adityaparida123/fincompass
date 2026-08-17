"""Cash-flow forecasting inference.

Supports three tiers:
1. ML model (RandomForest) — requires >= 3 months of data
2. Rolling average baseline — requires >= 1 month of data
3. Insufficient data — structured response explaining what's needed
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.config import ARTIFACTS_DIR, FEATURE_VERSION, MIN_MONTHS_FOR_FORECAST, MODEL_VERSIONS
from ml.features.cashflow_features import cashflow_features, monthly_cashflow


class CashflowForecaster:
    MODEL_NAME = "cashflow_forecaster"

    def __init__(self, model_path: Path | None = None):
        self.model_path = model_path or ARTIFACTS_DIR / "cashflow_forecaster.joblib"
        self._artifact = None

    def _load(self):
        if self._artifact is None:
            if not self.model_path.exists():
                raise FileNotFoundError(
                    f"Forecaster model not found at {self.model_path}. Run training first."
                )
            self._artifact = joblib.load(self.model_path)

    def forecast(self, transactions: pd.DataFrame, months_ahead: int = 1) -> dict:
        if transactions.empty:
            return self._insufficient_data_response(transactions, months_ahead)

        monthly = monthly_cashflow(transactions)
        feats = cashflow_features(monthly)

        if not feats:
            return self._insufficient_data_response(transactions, months_ahead)

        # Try ML model first (needs >= MIN_MONTHS_FOR_FORECAST months)
        months_available = feats.get("months_available", 0)
        if months_available >= MIN_MONTHS_FOR_FORECAST:
            try:
                return self._ml_forecast(monthly, feats, months_ahead)
            except FileNotFoundError:
                # Model artifact not available — fall back to baseline
                return self._baseline_forecast(monthly, feats, months_ahead)

        if months_available >= 1:
            # Fallback: rolling average baseline for limited data
            return self._baseline_forecast(monthly, feats, months_ahead)

        return self._insufficient_data_response(transactions, months_ahead)

    def _ml_forecast(self, monthly: pd.DataFrame, feats: dict, months_ahead: int) -> dict:
        """Full ML model forecast using trained RandomForest."""
        self._load()
        model = self._artifact["model"]

        X = np.array([[
            feats.get("mean_cashflow", 0),
            feats.get("std_cashflow", 0),
            feats.get("mean_income", 0),
            feats.get("mean_expenses", 0),
            feats.get("income_consistency", 0),
            feats.get("trend", 0),
        ]])

        expected = float(model.predict(X)[0])
        std = feats.get("std_cashflow", abs(expected) * 0.2)
        lower = expected - 1.5 * std
        upper = expected + 1.5 * std

        last_month = monthly["month"].iloc[-1]
        forecast_month = str(last_month + months_ahead)

        confidence = min(0.9, 0.4 + feats.get("income_consistency", 0) * 0.3 + min(feats.get("months_available", 0) / 12, 0.3))

        return {
            "status": "success",
            "method": "ml_model",
            "prediction": {
                "value": round(expected, 2),
                "confidence": round(confidence, 3),
            },
            "forecasts": [{
                "forecast_month": forecast_month,
                "expected_cashflow": round(expected, 2),
                "lower_range": round(lower, 2),
                "upper_range": round(upper, 2),
            }],
            "explanation": [
                {
                    "factor": "mean_income",
                    "impact": "high",
                    "description": f"Average monthly income: ₹{feats.get('mean_income', 0):,.0f}.",
                },
                {
                    "factor": "mean_expenses",
                    "impact": "high",
                    "description": f"Average monthly expenses: ₹{feats.get('mean_expenses', 0):,.0f}.",
                },
                {
                    "factor": "income_consistency",
                    "impact": "medium",
                    "description": f"Income consistency score: {feats.get('income_consistency', 0):,.2f}.",
                },
            ],
            "model": {
                "name": self.MODEL_NAME,
                "version": MODEL_VERSIONS[self.MODEL_NAME],
                "feature_version": FEATURE_VERSION,
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }

    def _baseline_forecast(self, monthly: pd.DataFrame, feats: dict, months_ahead: int) -> dict:
        """Statistical baseline forecast using rolling averages.

        Used when there is some data but not enough for the ML model.
        Clearly labeled as a baseline, not an ML prediction.
        """
        mean_income = feats.get("mean_income", 0)
        mean_expenses = feats.get("mean_expenses", 0)
        mean_cashflow = feats.get("mean_cashflow", 0)

        # Use the last observed values with slight trend adjustment
        last_income = float(monthly["income"].iloc[-1]) if len(monthly) > 0 else mean_income
        last_expenses = float(monthly["expenses"].iloc[-1]) if len(monthly) > 0 else mean_expenses
        trend = feats.get("trend", 0)

        expected = last_income - last_expenses + (trend * months_ahead)
        # Conservative bounds: use std if available, else 20% of mean
        std = feats.get("std_cashflow", abs(mean_cashflow) * 0.2)
        lower = expected - 1.5 * std
        upper = expected + 1.5 * std

        last_month = monthly["month"].iloc[-1]
        forecast_month = str(last_month + months_ahead)

        confidence = min(0.6, 0.2 + min(feats.get("months_available", 0) / 6, 0.4))

        return {
            "status": "success",
            "method": "rolling_baseline",
            "prediction": {
                "value": round(expected, 2),
                "confidence": round(confidence, 3),
            },
            "forecasts": [{
                "forecast_month": forecast_month,
                "expected_cashflow": round(expected, 2),
                "lower_range": round(lower, 2),
                "upper_range": round(upper, 2),
            }],
            "explanation": [
                {
                    "factor": "method",
                    "impact": "medium",
                    "description": (
                        f"Based on {feats.get('months_available', 0)} month(s) of data. "
                        "A statistical baseline is used until more data is available "
                        "for the ML model."
                    ),
                },
                {
                    "factor": "mean_income",
                    "impact": "high",
                    "description": f"Average monthly income: ₹{mean_income:,.0f}.",
                },
                {
                    "factor": "mean_expenses",
                    "impact": "high",
                    "description": f"Average monthly expenses: ₹{mean_expenses:,.0f}.",
                },
            ],
            "model": {
                "name": self.MODEL_NAME,
                "version": MODEL_VERSIONS[self.MODEL_NAME],
                "feature_version": FEATURE_VERSION,
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }

    def _insufficient_data_response(self, transactions: pd.DataFrame, months_ahead: int) -> dict:
        """Structured response when not enough data for any forecast."""
        available_months = 0
        if not transactions.empty and "date" in transactions.columns:
            dates = pd.to_datetime(transactions["date"], errors="coerce").dropna()
            if not dates.empty:
                available_months = dates.dt.to_period("M").nunique()

        return {
            "status": "insufficient_data",
            "method": "none",
            "prediction": {"value": None, "confidence": 0.0},
            "forecasts": [],
            "explanation": [],
            "available_months": available_months,
            "required_months": MIN_MONTHS_FOR_FORECAST,
            "message": (
                f"Not enough historical data for a forecast. "
                f"Currently available: {available_months} month(s). "
                f"Recommended: {MIN_MONTHS_FOR_FORECAST}+ months."
            ),
            "model": {
                "name": self.MODEL_NAME,
                "version": MODEL_VERSIONS[self.MODEL_NAME],
                "feature_version": FEATURE_VERSION,
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }
