"""ML service layer — bridges FastAPI with the ML inference pipeline."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import invalidate_user_financial_cache
from app.core.exceptions import NotFoundError
from app.db.models.debt import DebtObligation
from app.db.models.savings import SavingsGoal, SavingsGoalStatus
from app.db.models.transaction import Transaction
from app.services.ml.persistence import save_category_correction, save_ml_prediction
from ml.config import MODEL_VERSIONS
from ml.pipelines.inference_pipeline import get_pipeline


async def _fetch_transactions(
    db: AsyncSession,
    user_id: int,
    months: int = 12,
) -> pd.DataFrame:
    """Retrieve minimum required transaction data for ML inference."""
    start = date.today() - timedelta(days=months * 30)
    stmt = (
        select(Transaction)
        .where(
            Transaction.user_id == user_id,
            Transaction.is_deleted.is_(False),
            Transaction.date >= start,
        )
        .order_by(Transaction.date)
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return pd.DataFrame(columns=["user_id", "date", "amount", "type", "category", "description"])

    return pd.DataFrame([
        {
            "user_id": str(user_id),
            "date": r.date.isoformat(),
            "amount": float(r.amount),
            "type": r.transaction_type.value,
            "category": r.category,
            "description": r.description,
        }
        for r in rows
    ])


async def _user_debt_and_savings(db: AsyncSession, user_id: int) -> tuple[float, float]:
    debt_stmt = select(func.coalesce(func.sum(DebtObligation.monthly_payment), 0)).where(
        DebtObligation.user_id == user_id
    )
    savings_stmt = select(func.coalesce(func.sum(SavingsGoal.current_amount), 0)).where(
        SavingsGoal.user_id == user_id,
        SavingsGoal.status == SavingsGoalStatus.active,
    )
    debt_payment = float((await db.execute(debt_stmt)).scalar_one())
    current_savings = float((await db.execute(savings_stmt)).scalar_one())
    return debt_payment, current_savings


async def _persist_result(
    db: AsyncSession,
    user_id: int,
    prediction_type: str,
    result: dict,
    *,
    value_key: str = "prediction",
) -> dict:
    model = result.get("model", {})
    prediction = result.get(value_key, result.get("prediction", {}))
    confidence = prediction.get("confidence") if isinstance(prediction, dict) else None
    payload = result.copy()
    if "prediction" in payload and isinstance(payload["prediction"], dict):
        payload = {**payload, **payload["prediction"]}

    await save_ml_prediction(
        db,
        user_id=user_id,
        prediction_type=prediction_type,
        prediction_value=payload,
        model_name=model.get("name", prediction_type),
        model_version=model.get("version", MODEL_VERSIONS.get(prediction_type, "1.0.0")),
        confidence=confidence,
        feature_version=model.get("feature_version"),
    )
    return result


async def categorize_transaction(
    description: str,
    amount: Decimal,
    transaction_type: str = "expense",
) -> dict:
    pipeline = get_pipeline()
    return pipeline.categorize(description, float(amount), transaction_type)


async def detect_anomaly(
    db: AsyncSession,
    user_id: int,
    amount: Decimal | None = None,
) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    result = pipeline.detect_anomaly(str(user_id), tx_df, float(amount) if amount else None)
    return await _persist_result(db, user_id, "anomaly", result)


async def get_spending_patterns(db: AsyncSession, user_id: int) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    result = pipeline.detect_patterns(str(user_id), tx_df)
    return await _persist_result(db, user_id, "spending_patterns", result)


async def get_cashflow_forecast(db: AsyncSession, user_id: int) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    result = pipeline.forecast_cashflow(str(user_id), tx_df)
    return await _persist_result(db, user_id, "cashflow_forecast", result)


async def get_savings_capacity(db: AsyncSession, user_id: int) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    debt_payment, current_savings = await _user_debt_and_savings(db, user_id)
    result = pipeline.predict_savings(str(user_id), tx_df, debt_payment, current_savings)
    return await _persist_result(db, user_id, "savings_capacity", result)


async def correct_category(
    db: AsyncSession,
    user_id: int,
    transaction_id: str,
    original: str,
    corrected: str,
) -> dict:
    pipeline = get_pipeline()
    record = pipeline.correct_category(str(user_id), transaction_id, original, corrected)

    if transaction_id.isdigit():
        stmt = select(Transaction).where(
            Transaction.id == int(transaction_id),
            Transaction.user_id == user_id,
            Transaction.is_deleted.is_(False),
        )
        tx = (await db.execute(stmt)).scalar_one_or_none()
        if tx is None:
            raise NotFoundError("Transaction not found.")
        tx.category = corrected

    await save_category_correction(
        db,
        user_id=user_id,
        transaction_id=transaction_id,
        original_prediction=original,
        corrected_category=corrected,
        model_name="transaction_classifier",
        model_version=MODEL_VERSIONS["transaction_classifier"],
    )
    await invalidate_user_financial_cache(user_id)
    pipeline.invalidate_cache(str(user_id))
    return record


async def recalculate_all(db: AsyncSession, user_id: int) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    debt_payment, current_savings = await _user_debt_and_savings(db, user_id)
    result = pipeline.recalculate_after_correction(
        str(user_id), tx_df, debt_payment, current_savings
    )

    from app.services.readiness.service import compute_and_store

    readiness = await compute_and_store(db, user_id)
    result["readiness"] = {
        "score": readiness.score,
        "version": readiness.version,
        "summary": readiness.summary,
    }
    await invalidate_user_financial_cache(user_id)
    await _persist_result(db, user_id, "recalculate", result, value_key="forecast")
    return result
