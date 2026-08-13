"""Fairness testing — ensure protected characteristics are excluded."""

from __future__ import annotations

import pandas as pd

from ml.config import PROTECTED_CHARACTERISTICS


def audit_features(feature_columns: list[str]) -> dict:
    """Check that no protected characteristics are used as model features."""
    normalized = {c.lower().strip() for c in feature_columns}
    violations = normalized & PROTECTED_CHARACTERISTICS
    suspicious_proxies = _detect_proxy_features(normalized)

    return {
        "passed": len(violations) == 0 and len(suspicious_proxies) == 0,
        "protected_violations": sorted(violations),
        "suspicious_proxies": suspicious_proxies,
        "feature_count": len(feature_columns),
    }


def _detect_proxy_features(columns: set[str]) -> list[str]:
    """Flag columns that may proxy protected characteristics."""
    proxy_patterns = {
        "gender", "sex", "male", "female",
        "religion", "caste", "race", "ethnic",
        "disability", "political",
    }
    return sorted(columns & proxy_patterns)


def fairness_report(
    feature_df: pd.DataFrame,
    protected_col: str | None = None,
    predictions: list | None = None,
) -> dict:
    """Generate fairness audit report.

    If protected_col is present (synthetic audit only), compute
    prediction rate parity across groups. Protected col must NEVER
    be used as a model input.
    """
    audit = audit_features(list(feature_df.columns))

    report = {
        "feature_audit": audit,
        "demographic_parity": None,
    }

    if protected_col and protected_col in feature_df.columns and predictions is not None:
        df = feature_df[[protected_col]].copy()
        df["prediction"] = predictions
        rates = df.groupby(protected_col)["prediction"].mean().to_dict()
        report["demographic_parity"] = {
            "groups": rates,
            "max_disparity": max(rates.values()) - min(rates.values()) if rates else 0,
        }

    return report
