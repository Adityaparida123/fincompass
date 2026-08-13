"""Cash-flow forecasting inference."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.config import ARTIFACTS_DIR, FEATURE_VERSION, MODEL_VERSIONS
from ml.features.cashflow_features import cashflow_features, monthly_cashflow
from ml.preprocessing.validation import check_sufficient_data


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
        self._load()
        model = self._artifact["model"]
        feature_names = self._artifact["feature_names"]

        sufficient, msg = check_sufficient_data(transactions, "forecast")
        if not sufficient:
            return {
                "prediction": {"value": None, "confidence": 0, "message": msg},
                "forecasts": [],
                "model": {"name": self.MODEL_NAME, "version": MODEL_VERSIONS[self.MODEL_NAME]},
                "timestamp": datetime.now(UTC).isoformat(),
            }

        monthly = monthly_cashflow(transactions)
        feats = cashflow_features(monthly)

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
                    "description": f"Income consistency score: {feats.get('income_consistency', 0):.2f}.",
                },
            ],
            "model": {
                "name": self.MODEL_NAME,
                "version": MODEL_VERSIONS[self.MODEL_NAME],
                "feature_version": FEATURE_VERSION,
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }
