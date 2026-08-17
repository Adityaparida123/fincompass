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
    """Extract features for forecasting.

    Supports single-month data by using the observed values directly
    (std = 0, trend = 0, consistency = 1.0) so the baseline forecast
    can still produce a meaningful estimate from limited history.
    """
    if len(monthly) < 1:
        return {}

    cf = monthly["cashflow"]
    income = monthly["income"]
    expenses = monthly["expenses"]

    mean_income = float(income.mean())
    mean_expenses = float(expenses.mean())
    mean_cf = float(cf.mean())

    if len(monthly) >= 2:
        income_cv = float(income.std() / income.mean()) if income.mean() > 0 else 0
        expense_cv = float(expenses.std() / expenses.mean()) if expenses.mean() > 0 else 0
        std_cf = float(cf.std())
        trend = float(cf.iloc[-1] - cf.iloc[0]) / max(len(cf), 1)
    else:
        income_cv = 0.0
        expense_cv = 0.0
        std_cf = 0.0
        trend = 0.0

    return {
        "mean_cashflow": mean_cf,
        "std_cashflow": std_cf,
        "mean_income": mean_income,
        "mean_expenses": mean_expenses,
        "income_consistency": 1.0 - min(income_cv, 1.0),
        "expense_consistency": 1.0 - min(expense_cv, 1.0),
        "trend": trend,
        "months_available": len(monthly),
    }


def category_monthly_expenses(df: pd.DataFrame) -> pd.DataFrame:
    """Compute monthly spending by category for category-level forecasting.

    Returns a DataFrame with columns: month, category, amount.
    Only includes expense transactions.
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.to_period("M")

    expenses = df[df["type"] == "expense"]
    if expenses.empty:
        return pd.DataFrame(columns=["month", "category", "amount"])

    grouped = (
        expenses.groupby(["month", "category"])["amount"]
        .sum()
        .reset_index()
        .rename(columns={"amount": "amount"})
    )
    return grouped


def category_forecasts(df: pd.DataFrame, months_ahead: int = 1) -> list[dict]:
    """Produce per-category expense forecasts using recent monthly averages.

    Categories with at least 1 month of data get a forecast.
    """
    cat_monthly = category_monthly_expenses(df)
    if cat_monthly.empty:
        return []

    forecasts = []
    for category, grp in cat_monthly.groupby("category"):
        grp_sorted = grp.sort_values("month")
        amounts = grp_sorted["amount"].values
        months_of_data = len(amounts)

        predicted = float(amounts.mean())
        if months_of_data >= 2:
            std = float(amounts.std())
            lower = predicted - 1.5 * std
            upper = predicted + 1.5 * std
        else:
            lower = predicted * 0.8
            upper = predicted * 1.2

        forecasts.append({
            "category": str(category),
            "predicted": round(predicted, 2),
            "lower": round(max(lower, 0), 2),
            "upper": round(upper, 2),
            "months_of_data": months_of_data,
        })

    forecasts.sort(key=lambda x: x["predicted"], reverse=True)
    return forecasts
