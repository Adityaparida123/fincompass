"""Unified ML inference pipeline with cache invalidation support."""

from __future__ import annotations

from datetime import UTC, datetime

import pandas as pd

from ml.config import MODEL_VERSIONS
from ml.features.behavioral_features import detect_spending_patterns
from ml.inference.anomaly import AnomalyDetector
from ml.inference.classifier import TransactionClassifier, get_corrections, save_correction
from ml.inference.forecast import CashflowForecaster
from ml.inference.savings import SavingsPredictor
from ml.preprocessing.cleaning import clean_transactions


class InferencePipeline:
    """Orchestrates all ML inference with versioning and cache management."""

    def __init__(self):
        self.classifier = TransactionClassifier()
        self.anomaly_detector = AnomalyDetector()
        self.forecaster = CashflowForecaster()
        self.savings_predictor = SavingsPredictor()
        self._cache: dict[str, dict] = {}

    def _cache_key(self, user_id: str, task: str) -> str:
        return f"{user_id}:{task}"

    def invalidate_cache(self, user_id: str, tasks: list[str] | None = None) -> None:
        """Invalidate cached predictions after user data correction."""
        if tasks is None:
            keys = [k for k in self._cache if k.startswith(f"{user_id}:")]
        else:
            keys = [self._cache_key(user_id, t) for t in tasks]
        for key in keys:
            self._cache.pop(key, None)

    def categorize(self, description: str, amount: float, tx_type: str = "expense") -> dict:
        return self.classifier.predict(description, amount, tx_type)

    def correct_category(
        self,
        user_id: str,
        transaction_id: str,
        original: str,
        corrected: str,
    ) -> dict:
        record = save_correction(transaction_id, original, corrected, user_id)
        self.invalidate_cache(user_id)
        return record

    def detect_anomaly(
        self,
        user_id: str,
        transactions_df: pd.DataFrame,
        current_amount: float | None = None,
    ) -> dict:
        df = clean_transactions(transactions_df)
        return self.anomaly_detector.detect(df, user_id, current_amount)

    def forecast_cashflow(self, user_id: str, transactions_df: pd.DataFrame) -> dict:
        cache_key = self._cache_key(user_id, "forecast")
        if cache_key in self._cache:
            return self._cache[cache_key]

        df = clean_transactions(transactions_df)
        result = self.forecaster.forecast(df)
        self._cache[cache_key] = result
        return result

    def predict_savings(
        self,
        user_id: str,
        transactions_df: pd.DataFrame,
        debt_payment: float = 0,
        current_savings: float = 0,
    ) -> dict:
        cache_key = self._cache_key(user_id, "savings")
        if cache_key in self._cache:
            return self._cache[cache_key]

        df = clean_transactions(transactions_df)
        result = self.savings_predictor.predict(df, debt_payment, current_savings)
        self._cache[cache_key] = result
        return result

    def detect_patterns(self, user_id: str, transactions_df: pd.DataFrame) -> dict:
        df = clean_transactions(transactions_df)
        patterns = detect_spending_patterns(df)
        return {
            "prediction": {
                "value": patterns,
                "confidence": 0.8 if patterns else 0.3,
            },
            "patterns": patterns,
            "model": {
                "name": "spending_patterns",
                "version": MODEL_VERSIONS["spending_patterns"],
            },
            "timestamp": datetime.now(UTC).isoformat(),
        }

    def recalculate_after_correction(
        self,
        user_id: str,
        transactions_df: pd.DataFrame,
        debt_payment: float = 0,
        current_savings: float = 0,
    ) -> dict:
        """Recalculate all affected predictions after data correction."""
        self.invalidate_cache(user_id)
        return {
            "forecast": self.forecast_cashflow(user_id, transactions_df),
            "savings": self.predict_savings(user_id, transactions_df, debt_payment, current_savings),
            "patterns": self.detect_patterns(user_id, transactions_df),
            "corrections": get_corrections(user_id),
            "timestamp": datetime.now(UTC).isoformat(),
        }


_pipeline: InferencePipeline | None = None


def get_pipeline() -> InferencePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = InferencePipeline()
    return _pipeline
