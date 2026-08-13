"""SHAP-based explainability for ML predictions."""

from __future__ import annotations

from typing import Any


def explain_prediction(
    model,
    features: Any,
    feature_names: list[str] | None = None,
    top_k: int = 5,
) -> list[dict]:
    """Generate SHAP explanations for a prediction.

    Falls back to feature importances when SHAP is unavailable.
    """
    try:
        import shap
        import numpy as np

        if hasattr(model, "predict_proba"):
            explainer = shap.Explainer(model)
            shap_values = explainer(features)
            values = shap_values.values[0] if len(shap_values.values.shape) > 1 else shap_values.values

            if feature_names is None:
                feature_names = [f"feature_{i}" for i in range(len(values))]

            pairs = sorted(
                zip(feature_names, values, strict=False),
                key=lambda x: abs(x[1]),
                reverse=True,
            )[:top_k]

            return [
                {
                    "factor": name,
                    "impact": _impact_level(val),
                    "shap_value": round(float(val), 4),
                    "description": _humanize_factor(name, val),
                }
                for name, val in pairs
            ]
    except (ImportError, Exception):
        pass

    return _fallback_importance(model, feature_names, top_k)


def _impact_level(value: float) -> str:
    av = abs(value)
    if av > 0.3:
        return "high"
    if av > 0.1:
        return "medium"
    return "low"


def _humanize_factor(name: str, value: float) -> str:
    direction = "increased" if value > 0 else "decreased"
    readable = name.replace("_", " ")
    return f"{readable.title()} {direction} the prediction."


def _fallback_importance(model, feature_names, top_k) -> list[dict]:
    if hasattr(model, "feature_importances_") and feature_names:
        importances = model.feature_importances_
        pairs = sorted(
            zip(feature_names, importances, strict=False),
            key=lambda x: x[1],
            reverse=True,
        )[:top_k]
        return [
            {
                "factor": name,
                "impact": _impact_level(imp),
                "shap_value": round(float(imp), 4),
                "description": f"{name.replace('_', ' ').title()} is an important factor.",
            }
            for name, imp in pairs
        ]
    return []
