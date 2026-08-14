"""Persist ML outputs to the authoritative MongoDB database."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.db.mongo import Doc, MongoDatabase
from ml.config import FEATURE_VERSION


async def save_ml_prediction(
    db: MongoDatabase,
    *,
    user_id: int,
    prediction_type: str,
    prediction_value: dict[str, Any],
    model_name: str,
    model_version: str,
    confidence: float | None = None,
    feature_version: str | None = None,
) -> Doc:
    return await db.insert(
        "ml_predictions",
        {
            "user_id": user_id,
            "prediction_type": prediction_type,
            "prediction_value": prediction_value,
            "confidence": Decimal(str(confidence)) if confidence is not None else None,
            "model_name": model_name,
            "model_version": model_version,
            "feature_version": feature_version or FEATURE_VERSION,
        },
    )


async def save_category_correction(
    db: MongoDatabase,
    *,
    user_id: int,
    transaction_id: str,
    original_prediction: str,
    corrected_category: str,
    model_name: str,
    model_version: str,
) -> Doc:
    return await save_ml_prediction(
        db,
        user_id=user_id,
        prediction_type="category_correction",
        prediction_value={
            "transaction_id": transaction_id,
            "original_prediction": original_prediction,
            "corrected_category": corrected_category,
        },
        model_name=model_name,
        model_version=model_version,
        confidence=None,
    )
