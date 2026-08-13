"""Savings capacity feature engineering."""

from __future__ import annotations

import pandas as pd


def savings_features(
    monthly: pd.DataFrame,
    debt_payment: float = 0,
    current_savings: float = 0,
) -> dict:
    """Compute features for savings capacity estimation."""
    if monthly.empty:
        return {}

    avg_income = float(monthly["income"].mean())
    avg_expenses = float(monthly["expenses"].mean())
    essential_ratio = 0.65
    discretionary = avg_expenses * (1 - essential_ratio)

    expense_volatility = (
        float(monthly["expenses"].std() / monthly["expenses"].mean())
        if monthly["expenses"].mean() > 0 and len(monthly) > 1
        else 0
    )

    historical_savings = float((monthly["income"] - monthly["expenses"]).mean())
    net_after_debt = avg_income - avg_expenses - debt_payment

    return {
        "avg_income": avg_income,
        "avg_expenses": avg_expenses,
        "essential_expenses": avg_expenses * essential_ratio,
        "discretionary_expenses": discretionary,
        "debt_obligations": debt_payment,
        "expense_volatility": expense_volatility,
        "historical_net_savings": historical_savings,
        "current_savings_balance": current_savings,
        "net_after_debt": net_after_debt,
    }
