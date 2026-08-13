"""Cross-validation and holdout validation utilities."""

from __future__ import annotations

import pandas as pd

from ml.preprocessing.validation import validate_chronological_split


def chronological_split(
    df: pd.DataFrame,
    date_col: str = "date",
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split time-series data chronologically to prevent leakage."""
    df = df.sort_values(date_col).reset_index(drop=True)
    n = len(df)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train = df.iloc[:train_end]
    val = df.iloc[train_end:val_end]
    test = df.iloc[val_end:]

    if not test.empty and not train.empty:
        validate_chronological_split(train[date_col], test[date_col])

    return train, val, test


def stratified_split_indices(y, test_size: float = 0.2, random_state: int = 42):
    from sklearn.model_selection import train_test_split
    return train_test_split(
        range(len(y)), test_size=test_size, stratify=y, random_state=random_state
    )
