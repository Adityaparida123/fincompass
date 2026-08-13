"""Debt-related feature engineering."""

from __future__ import annotations


def debt_features(
    monthly_income: float,
    debt_payments: float,
    total_expenses: float,
) -> dict:
    """Compute debt burden features."""
    if monthly_income <= 0:
        return {"debt_to_income": 0, "debt_burden_pct": 0}

    dti = debt_payments / monthly_income
    total_obligations = (debt_payments + total_expenses) / monthly_income

    return {
        "debt_to_income": round(dti, 4),
        "debt_burden_pct": round(dti * 100, 2),
        "total_obligation_ratio": round(total_obligations, 4),
        "disposable_after_debt": round(monthly_income - total_expenses - debt_payments, 2),
    }
