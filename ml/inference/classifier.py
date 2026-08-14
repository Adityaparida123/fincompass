"""Transaction categorization inference."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import joblib
import pandas as pd

from ml.config import (
    ARTIFACTS_DIR,
    CLASSIFIER_CONFIDENCE_THRESHOLD,
    FEATURE_VERSION,
    LOW_CONFIDENCE_THRESHOLD,
    MODEL_VERSIONS,
)
from ml.evaluation.metrics import confidence_label
from ml.preprocessing.pipelines import prepare_classifier_text


class TransactionClassifier:
    MODEL_NAME = "transaction_classifier"

    def __init__(self, model_path: Path | None = None):
        self.model_path = model_path or ARTIFACTS_DIR / "transaction_classifier.joblib"
        self._pipeline = None

    def _load(self):
        if self._pipeline is None:
            if not self.model_path.exists():
                raise FileNotFoundError(
                    f"Classifier model not found at {self.model_path}. Run training first."
                )
            self._pipeline = joblib.load(self.model_path)

    def predict(self, description: str, amount: float, tx_type: str = "expense") -> dict:
        self._load()
        text = prepare_classifier_text(pd.DataFrame([{
            "description": description,
            "type": tx_type,
        }]))[0]

        category = self._pipeline.predict([text])[0]

        confidence = LOW_CONFIDENCE_THRESHOLD
        if hasattr(self._pipeline, "predict_proba"):
            proba = self._pipeline.predict_proba([text])[0]
            confidence = float(proba.max())
        elif hasattr(self._pipeline, "decision_function"):
            scores = self._pipeline.decision_function([text])[0]
            confidence = float(min(0.95, abs(scores.max()) / (abs(scores).sum() + 1e-6)))

        if confidence < CLASSIFIER_CONFIDENCE_THRESHOLD:
            category = "other"

        needs_review = confidence < CLASSIFIER_CONFIDENCE_THRESHOLD

        return {
            "prediction": {
                "value": category,
                "confidence": round(confidence, 3),
                "confidence_label": confidence_label(confidence),
                "needs_review": needs_review,
            },
            "model": {
                "name": self.MODEL_NAME,
                "version": MODEL_VERSIONS[self.MODEL_NAME],
                "feature_version": FEATURE_VERSION,
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }


# In-memory correction store (production: persist to DB)
_category_corrections: list[dict] = []


def save_correction(
    transaction_id: str,
    original_prediction: str,
    corrected_category: str,
    user_id: str,
) -> dict:
    """Save user category correction without overwriting audit history."""
    record = {
        "transaction_id": transaction_id,
        "user_id": user_id,
        "original_prediction": original_prediction,
        "corrected_category": corrected_category,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    _category_corrections.append(record)
    return record


def get_corrections(user_id: str | None = None) -> list[dict]:
    if user_id:
        return [c for c in _category_corrections if c["user_id"] == user_id]
    return list(_category_corrections)
