"""Demo scenario for hackathon presentation."""

from __future__ import annotations

import json

from decimal import Decimal

import pandas as pd

from app.services.readiness.engine import ReadinessInput, compute_readiness
from ml.data.synthetic.generator import generate_demo_user
from ml.pipelines.inference_pipeline import InferencePipeline


def run_demo() -> dict:
    """Execute the complete demo flow from the specification."""
    demo = generate_demo_user()
    tx_df = demo["transactions"]
    pipeline = InferencePipeline()
    user_id = demo["user_id"]

    patterns = pipeline.detect_patterns(user_id, tx_df)
    forecast = pipeline.forecast_cashflow(user_id, tx_df)
    savings = pipeline.predict_savings(
        user_id, tx_df,
        debt_payment=demo["debt_obligations"],
        current_savings=demo["savings"],
    )

    readiness_before = compute_readiness(ReadinessInput(
        income=Decimal("35000"),
        total_expenses=Decimal("36000"),
        essential_monthly_expenses=Decimal("25000"),
        debt_payments=Decimal("6000"),
        savings=Decimal("8000"),
        income_months=[Decimal("35000")] * 6,
        expense_months=[Decimal(str(36000 + i * 200)) for i in range(6)],
    ))

    readiness_after = compute_readiness(ReadinessInput(
        income=Decimal("45000"),
        total_expenses=Decimal("36000"),
        essential_monthly_expenses=Decimal("25000"),
        debt_payments=Decimal("6000"),
        savings=Decimal("8000"),
        income_months=[Decimal("45000")] * 6,
        expense_months=[Decimal(str(36000 + i * 200)) for i in range(6)],
    ))

    result = {
        "demo_user": {
            "income": demo["monthly_income"],
            "expenses": demo["monthly_expenses"],
            "savings": demo["savings"],
            "debt": demo["debt_obligations"],
        },
        "ml_insights": {
            "patterns": patterns.get("patterns", []),
            "forecast": forecast.get("forecasts", []),
            "savings_capacity": savings.get("savings_capacity", {}),
        },
        "readiness": {
            "before_correction": {
                "score": readiness_before.score,
                "factors": [
                    {"name": f.name, "impact": f.impact, "direction": f.direction}
                    for f in readiness_before.factors
                ],
            },
            "after_correction": {
                "score": readiness_after.score,
                "factors": [
                    {"name": f.name, "impact": f.impact, "direction": f.direction}
                    for f in readiness_after.factors
                ],
            },
            "score_change": f"{readiness_before.score} → {readiness_after.score}",
            "explanation": (
                "Your score changed because estimated cash-flow stability improved "
                "after correcting your income from ₹35,000 to ₹45,000."
            ),
        },
        "finai_narrative": _build_finai_narrative(patterns, savings, readiness_before, readiness_after),
    }
    return result


def _build_finai_narrative(patterns, savings, before, after) -> str:
    lines = []
    for p in patterns.get("patterns", []):
        if "increase" in p.get("pattern", ""):
            lines.append(p.get("description", ""))

    cap = savings.get("savings_capacity", {})
    if cap:
        lines.append(
            f"Estimated savings capacity: ₹{cap.get('lower', 0):,.0f} – "
            f"₹{cap.get('upper', 0):,.0f}/month."
        )

    lines.append(
        f"Your readiness score changed from {before.score} to {after.score} "
        f"after correcting your income."
    )
    return " ".join(lines)


if __name__ == "__main__":
    demo_result = run_demo()
    print(json.dumps(demo_result, indent=2, default=str))
