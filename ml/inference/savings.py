"""Savings capacity prediction inference."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.config import ARTIFACTS_DIR, FEATURE_VERSION, MODEL_VERSIONS
from ml.features.cashflow_features import monthly_cashflow
from ml.features.savings_features import savings_features
from ml.preprocessing.validation import check_sufficient_data


class SavingsPredictor:
    MODEL_NAME = "savings_predictor"

    def __init__(self, model_path: Path | None = None):
        self.model_path = model_path or ARTIFACTS_DIR / "savings_predictor.joblib"
        self._artifact = None

    def _load(self):
        if self._artifact is None:
            if not self.model_path.exists():
                raise FileNotFoundError(
                    f"Savings model not found at {self.model_path}. Run training first."
                )
            self._artifact = joblib.load(self.model_path)

    def predict(
        self,
        transactions: pd.DataFrame,
        debt_payment: float = 0,
        current_savings: float = 0,
    ) -> dict:
        self._load()
        model = self._artifact["model"]
        feature_names = self._artifact["feature_names"]

        sufficient, msg = check_sufficient_data(transactions, "savings")
        if not sufficient:
            return {
                "prediction": {"value": None, "confidence": 0, "message": msg},
                "model": {"name": self.MODEL_NAME, "version": MODEL_VERSIONS[self.MODEL_NAME]},
                "timestamp": datetime.now(UTC).isoformat(),
            }

        monthly = monthly_cashflow(transactions)
        feats = savings_features(monthly, debt_payment, current_savings)

        X = np.array([[
            feats.get("avg_income", 0),
            feats.get("avg_expenses", 0),
            feats.get("discretionary_expenses", 0),
            feats.get("debt_obligations", 0),
            feats.get("expense_volatility", 0),
            feats.get("historical_net_savings", 0),
        ]])

        predicted = float(model.predict(X)[0])
        volatility = feats.get("expense_volatility", 0.1)
        lower = max(0, predicted * (1 - volatility))
        upper = predicted * (1 + volatility)

        confidence = min(0.85, 0.3 + min(len(monthly) / 6, 0.3) + (1 - min(volatility, 1)) * 0.25)

        return {
            "prediction": {
                "value": round(predicted, 2),
                "confidence": round(confidence, 3),
            },
            "savings_capacity": {
                "lower": round(lower, 2),
                "upper": round(upper, 2),
                "unit": "monthly",
                "currency": "INR",
                "disclaimer": (
                    "This is an estimated range, not a guarantee. "
                    "Actual savings depend on your choices."
                ),
            },
            "explanation": [
                {
                    "factor": "avg_income",
                    "impact": "high",
                    "description": f"Average monthly income: ₹{feats.get('avg_income', 0):,.0f}.",
                },
                {
                    "factor": "discretionary_expenses",
                    "impact": "medium",
                    "description": (
                        f"Discretionary spending: ₹{feats.get('discretionary_expenses', 0):,.0f}/month."
                    ),
                },
                {
                    "factor": "expense_volatility",
                    "impact": "medium" if volatility > 0.2 else "low",
                    "description": f"Expense volatility: {volatility:.2f}.",
                },
            ],
            "model": {
                "name": self.MODEL_NAME,
                "version": MODEL_VERSIONS[self.MODEL_NAME],
                "feature_version": FEATURE_VERSION,
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }
