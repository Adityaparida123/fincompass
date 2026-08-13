"""Feature importance extraction from trained models."""

from __future__ import annotations


def get_feature_importance(model, feature_names: list[str]) -> list[dict]:
    """Extract and rank feature importances."""
    if not hasattr(model, "feature_importances_"):
        if hasattr(model, "named_steps"):
            for step in reversed(list(model.named_steps.values())):
                if hasattr(step, "feature_importances_"):
                    model = step
                    break

    if not hasattr(model, "feature_importances_"):
        return []

    importances = model.feature_importances_
    pairs = sorted(
        zip(feature_names, importances, strict=False),
        key=lambda x: x[1],
        reverse=True,
    )
    return [
        {"feature": name, "importance": round(float(imp), 4)}
        for name, imp in pairs
    ]
