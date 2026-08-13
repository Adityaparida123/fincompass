"""ML service layer — bridges FastAPI with the ML inference pipeline."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.transaction import Transaction, TransactionType
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
    return pipeline.detect_anomaly(str(user_id), tx_df, float(amount) if amount else None)


async def get_spending_patterns(db: AsyncSession, user_id: int) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    return pipeline.detect_patterns(str(user_id), tx_df)


async def get_cashflow_forecast(db: AsyncSession, user_id: int) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    return pipeline.forecast_cashflow(str(user_id), tx_df)


async def get_savings_capacity(
    db: AsyncSession,
    user_id: int,
    debt_payment: float = 0,
    current_savings: float = 0,
) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    return pipeline.predict_savings(str(user_id), tx_df, debt_payment, current_savings)


async def correct_category(
    user_id: int,
    transaction_id: str,
    original: str,
    corrected: str,
) -> dict:
    pipeline = get_pipeline()
    return pipeline.correct_category(user_id, transaction_id, original, corrected)


async def recalculate_all(
    db: AsyncSession,
    user_id: int,
    debt_payment: float = 0,
    current_savings: float = 0,
) -> dict:
    pipeline = get_pipeline()
    tx_df = await _fetch_transactions(db, user_id)
    return pipeline.recalculate_after_correction(
        str(user_id), tx_df, debt_payment, current_savings
    )
