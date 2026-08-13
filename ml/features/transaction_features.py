"""Transaction-level feature engineering."""

from __future__ import annotations

import pandas as pd


def extract_transaction_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build numeric features for a single transaction in context."""
    out = df.copy()
    if "date" in out.columns:
        out["date"] = pd.to_datetime(out["date"])
        out["day_of_week"] = out["date"].dt.dayofweek
        out["day_of_month"] = out["date"].dt.day
        out["is_weekend"] = (out["day_of_week"] >= 5).astype(int)
        out["month"] = out["date"].dt.month

    out["log_amount"] = out["amount"].apply(lambda x: max(0, __import__("math").log1p(float(x))))
    return out


def compute_rolling_features(
    df: pd.DataFrame,
    user_id: str,
    window: int = 30,
) -> pd.DataFrame:
    """Compute rolling average and std for a user's transactions."""
    user_df = df[df["user_id"] == user_id].copy()
    user_df = user_df.sort_values("date")
    user_df["rolling_mean"] = user_df["amount"].rolling(window, min_periods=3).mean()
    user_df["rolling_std"] = user_df["amount"].rolling(window, min_periods=3).std()
    user_df["amount_deviation"] = (
        (user_df["amount"] - user_df["rolling_mean"]) / user_df["rolling_std"].replace(0, 1)
    )
    return user_df


def compute_category_frequency(df: pd.DataFrame, user_id: str) -> dict[str, float]:
    """Frequency of each category for a user."""
    user_df = df[df["user_id"] == user_id]
    if user_df.empty:
        return {}
    counts = user_df["category"].value_counts(normalize=True)
    return counts.to_dict()
