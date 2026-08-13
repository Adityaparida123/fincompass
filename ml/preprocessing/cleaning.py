"""Data cleaning utilities for ML pipelines."""

from __future__ import annotations

import re

import numpy as np
import pandas as pd

from ml.config import TRANSACTION_CATEGORIES


def normalize_description(text: str) -> str:
    """Lowercase, strip, and remove extra whitespace."""
    if not isinstance(text, str):
        return ""
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def clean_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """Clean transaction DataFrame for ML processing."""
    out = df.copy()

    if "description" in out.columns:
        out["description"] = out["description"].apply(normalize_description)

    if "amount" in out.columns:
        out["amount"] = pd.to_numeric(out["amount"], errors="coerce").abs()
        out = out[out["amount"] > 0]

    if "date" in out.columns:
        out["date"] = pd.to_datetime(out["date"], errors="coerce")
        out = out.dropna(subset=["date"])

    if "category" in out.columns:
        out["category"] = out["category"].str.lower().str.strip()
        valid = set(TRANSACTION_CATEGORIES)
        out.loc[~out["category"].isin(valid), "category"] = "other"

    if "type" in out.columns:
        out["type"] = out["type"].str.lower().str.strip()

    if "day_of_week" not in out.columns and "date" in out.columns:
        out["day_of_week"] = out["date"].dt.dayofweek

    out = out.drop_duplicates(subset=["user_id", "date", "amount", "description"], keep="first")
    return out.reset_index(drop=True)


def remove_outlier_amounts(
    df: pd.DataFrame,
    column: str = "amount",
    n_std: float = 5.0,
) -> pd.DataFrame:
    """Remove extreme outliers beyond n standard deviations."""
    if column not in df.columns or len(df) < 10:
        return df
    mean = df[column].mean()
    std = df[column].std()
    if std == 0 or np.isnan(std):
        return df
    mask = (df[column] - mean).abs() <= n_std * std
    return df[mask].reset_index(drop=True)
