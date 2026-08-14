"""Persist ML outputs to the authoritative PostgreSQL/SQLite database."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.ml_prediction import MLPrediction
from ml.config import FEATURE_VERSION


async def save_ml_prediction(
    db: AsyncSession,
    *,
    user_id: int,
    prediction_type: str,
    prediction_value: dict[str, Any],
    model_name: str,
    model_version: str,
    confidence: float | None = None,
    feature_version: str | None = None,
) -> MLPrediction:
    row = MLPrediction(
        user_id=user_id,
        prediction_type=prediction_type,
        prediction_value=prediction_value,
        confidence=Decimal(str(confidence)) if confidence is not None else None,
        model_name=model_name,
        model_version=model_version,
        feature_version=feature_version or FEATURE_VERSION,
    )
    db.add(row)
    await db.flush()
    return row


async def save_category_correction(
    db: AsyncSession,
    *,
    user_id: int,
    transaction_id: str,
    original_prediction: str,
    corrected_category: str,
    model_name: str,
    model_version: str,
) -> MLPrediction:
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
