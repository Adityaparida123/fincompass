"""Cash-flow feature engineering."""

from __future__ import annotations

import pandas as pd


def monthly_cashflow(df: pd.DataFrame) -> pd.DataFrame:
    """Compute monthly income, expenses, and net cash flow."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.to_period("M")

    income = (
        df[df["type"] == "income"]
        .groupby("month")["amount"]
        .sum()
        .rename("income")
    )
    expenses = (
        df[df["type"] == "expense"]
        .groupby("month")["amount"]
        .sum()
        .rename("expenses")
    )

    result = pd.concat([income, expenses], axis=1).fillna(0)
    result["cashflow"] = result["income"] - result["expenses"]
    result = result.reset_index()
    result["month_str"] = result["month"].astype(str)
    return result


def cashflow_features(monthly: pd.DataFrame) -> dict:
    """Extract features for forecasting."""
    if len(monthly) < 2:
        return {}

    cf = monthly["cashflow"]
    income = monthly["income"]
    expenses = monthly["expenses"]

    income_cv = float(income.std() / income.mean()) if income.mean() > 0 else 0
    expense_cv = float(expenses.std() / expenses.mean()) if expenses.mean() > 0 else 0

    return {
        "mean_cashflow": float(cf.mean()),
        "std_cashflow": float(cf.std()) if len(cf) > 1 else 0,
        "mean_income": float(income.mean()),
        "mean_expenses": float(expenses.mean()),
        "income_consistency": 1.0 - min(income_cv, 1.0),
        "expense_consistency": 1.0 - min(expense_cv, 1.0),
        "trend": float(cf.iloc[-1] - cf.iloc[0]) / max(len(cf), 1),
        "months_available": len(monthly),
    }
