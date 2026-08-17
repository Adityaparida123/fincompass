"""Input validation for ML pipelines."""

from __future__ import annotations

from datetime import datetime

import pandas as pd

from ml.config import (
    MIN_MONTHS_FOR_FORECAST,
    MIN_MONTHS_FOR_PATTERNS,
    MIN_MONTHS_FOR_SAVINGS,
    MIN_TRANSACTIONS_FOR_ANOMALY,
    PROTECTED_CHARACTERISTICS,
    TRANSACTION_CATEGORIES,
)


class ValidationError(Exception):
    """Raised when input data fails validation."""


def validate_transaction_input(data: dict) -> None:
    required = {"description", "amount"}
    missing = required - set(data.keys())
    if missing:
        raise ValidationError(f"Missing required fields: {missing}")
    if float(data["amount"]) <= 0:
        raise ValidationError("Amount must be positive.")


def validate_feature_columns(df: pd.DataFrame, allowed: set[str]) -> None:
    """Ensure no protected characteristics appear as features."""
    cols = {c.lower() for c in df.columns}
    forbidden = cols & PROTECTED_CHARACTERISTICS
    if forbidden:
        raise ValidationError(
            f"Protected characteristics must not be used as features: {forbidden}"
        )
    unknown = cols - allowed - PROTECTED_CHARACTERISTICS
    if unknown and len(unknown) > len(cols) * 0.5:
        raise ValidationError(f"Suspicious feature columns detected: {unknown}")


def validate_category(category: str) -> str:
    cat = category.lower().strip()
    if cat not in TRANSACTION_CATEGORIES:
        return "other"
    return cat


def check_sufficient_data(
    df: pd.DataFrame,
    task: str,
) -> tuple[bool, str]:
    """Return (sufficient, message) for a given ML task."""
    if df.empty:
        return False, "Not enough data yet."

    if task == "anomaly":
        if len(df) < MIN_TRANSACTIONS_FOR_ANOMALY:
            return False, f"Need at least {MIN_TRANSACTIONS_FOR_ANOMALY} transactions."

    if task in ("forecast", "savings", "patterns"):
        if "date" not in df.columns:
            return False, "Not enough data yet."
        dates = pd.to_datetime(df["date"], errors="coerce")
        months = dates.dt.to_period("M").nunique() if not dates.isna().all() else 0
        min_months = {
            "forecast": MIN_MONTHS_FOR_FORECAST,
            "savings": MIN_MONTHS_FOR_SAVINGS,
            "patterns": MIN_MONTHS_FOR_PATTERNS,
        }[task]
        if months < min_months:
            return False, f"Need at least {min_months} months of history."

    return True, ""


def validate_chronological_split(
    train_dates: pd.Series,
    test_dates: pd.Series,
) -> None:
    """Prevent data leakage in time-series splits."""
    if train_dates.max() >= test_dates.min():
        raise ValidationError(
            "Chronological split violated: training data contains future dates."
        )
