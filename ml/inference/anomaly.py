"""Spending anomaly detection inference."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import joblib
import pandas as pd

from ml.config import ARTIFACTS_DIR, FEATURE_VERSION, MODEL_VERSIONS
from ml.features.transaction_features import compute_rolling_features
from ml.preprocessing.validation import check_sufficient_data


class AnomalyDetector:
    MODEL_NAME = "anomaly_detector"

    def __init__(self, model_path: Path | None = None):
        self.model_path = model_path or ARTIFACTS_DIR / "anomaly_detector.joblib"
        self._artifact = None

    def _load(self):
        if self._artifact is None:
            if not self.model_path.exists():
                raise FileNotFoundError(
                    f"Anomaly model not found at {self.model_path}. Run training first."
                )
            self._artifact = joblib.load(self.model_path)

    def detect(
        self,
        transactions: pd.DataFrame,
        user_id: str,
        current_amount: float | None = None,
    ) -> dict:
        self._load()
        model = self._artifact["model"]
        feature_cols = self._artifact["feature_columns"]

        sufficient, msg = check_sufficient_data(transactions, "anomaly")
        if not sufficient:
            return {
                "prediction": {"value": False, "confidence": 0, "message": msg},
                "anomaly": False,
                "severity": "none",
                "reason": msg,
                "model": {"name": self.MODEL_NAME, "version": MODEL_VERSIONS[self.MODEL_NAME]},
                "timestamp": datetime.now(UTC).isoformat(),
            }

        user_df = compute_rolling_features(transactions, user_id)
        latest = user_df.iloc[-1]

        features = pd.DataFrame([{
            "amount": current_amount or float(latest["amount"]),
            "rolling_mean": float(latest.get("rolling_mean", 0) or 0),
            "rolling_std": float(latest.get("rolling_std", 0) or 0),
            "amount_deviation": float(latest.get("amount_deviation", 0) or 0),
            "day_of_week": int(latest.get("day_of_week", 0)),
        }])

        prediction = model.predict(features[feature_cols])[0]
        is_anomaly = prediction == -1

        score = model.decision_function(features[feature_cols])[0]
        severity = "none"
        reason = "Spending is within normal range."
        if is_anomaly:
            deviation = float(features["amount_deviation"].iloc[0])
            if abs(deviation) > 3:
                severity = "high"
            elif abs(deviation) > 2:
                severity = "medium"
            else:
                severity = "low"
            reason = (
                "Unusual spending pattern detected: amount is significantly "
                "above recent average."
            )

        confidence = min(0.95, 0.5 + abs(score) / 10)

        return {
            "prediction": {
                "value": is_anomaly,
                "confidence": round(confidence, 3),
            },
            "anomaly": is_anomaly,
            "severity": severity,
            "reason": reason,
            "explanation": [{
                "factor": "amount_deviation",
                "impact": severity if is_anomaly else "low",
                "description": reason,
            }],
            "model": {
                "name": self.MODEL_NAME,
                "version": MODEL_VERSIONS[self.MODEL_NAME],
                "feature_version": FEATURE_VERSION,
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }
