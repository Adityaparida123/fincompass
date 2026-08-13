"""Behavioral spending pattern features."""

from __future__ import annotations

import pandas as pd


def detect_spending_patterns(df: pd.DataFrame) -> list[dict]:
    """Detect spending patterns using rolling averages and percentage changes."""
    patterns: list[dict] = []
    if df.empty or "date" not in df.columns:
        return patterns

    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    expenses = df[df["type"] == "expense"].copy()

    if expenses.empty:
        return patterns

    expenses["month"] = expenses["date"].dt.to_period("M")
    months = sorted(expenses["month"].unique())

    if len(months) < 2:
        return patterns

    recent = months[-1]
    prior = months[-2]

    for category in expenses["category"].unique():
        cat_df = expenses[expenses["category"] == category]
        recent_total = cat_df[cat_df["month"] == recent]["amount"].sum()
        prior_total = cat_df[cat_df["month"] == prior]["amount"].sum()

        if prior_total > 0:
            pct_change = ((recent_total - prior_total) / prior_total) * 100
            if abs(pct_change) >= 15:
                direction = "increase" if pct_change > 0 else "decrease"
                patterns.append({
                    "pattern": f"{category}_spending_{direction}",
                    "category": category,
                    "change_pct": round(float(pct_change), 1),
                    "confidence": min(0.95, 0.6 + abs(pct_change) / 100),
                    "description": (
                        f"{category.replace('_', ' ').title()} spending "
                        f"{'increased' if pct_change > 0 else 'decreased'} "
                        f"by about {abs(pct_change):.0f}% compared with the prior month."
                    ),
                })

    weekend = expenses[expenses["date"].dt.dayofweek >= 5]["amount"].sum()
    weekday = expenses[expenses["date"].dt.dayofweek < 5]["amount"].sum()
    total = weekend + weekday
    if total > 0:
        weekend_pct = weekend / total * 100
        if weekend_pct > 40:
            patterns.append({
                "pattern": "weekend_spending_spike",
                "category": "all",
                "change_pct": round(weekend_pct, 1),
                "confidence": 0.75,
                "description": (
                    f"About {weekend_pct:.0f}% of spending occurs on weekends, "
                    "which is higher than typical."
                ),
            })

    monthly_totals = expenses.groupby("month")["amount"].sum()
    if len(monthly_totals) >= 3:
        cv = float(monthly_totals.std() / monthly_totals.mean()) if monthly_totals.mean() > 0 else 0
        if cv > 0.25:
            patterns.append({
                "pattern": "high_expense_volatility",
                "category": "all",
                "change_pct": round(cv * 100, 1),
                "confidence": min(0.9, 0.5 + cv),
                "description": (
                    "Monthly expenses vary significantly, indicating "
                    "high expense volatility."
                ),
            })

    recurring = _detect_recurring_subscriptions(expenses)
    patterns.extend(recurring)

    return patterns


def _detect_recurring_subscriptions(expenses: pd.DataFrame) -> list[dict]:
    """Detect recurring subscription-like transactions."""
    patterns: list[dict] = []
    sub_cats = expenses[expenses["category"].isin(["subscriptions", "utilities"])]

    for desc, group in sub_cats.groupby("description"):
        if len(group) >= 2:
            amounts = group["amount"].values
            if amounts.std() / amounts.mean() < 0.05 if amounts.mean() > 0 else False:
                patterns.append({
                    "pattern": "recurring_subscription",
                    "category": group["category"].iloc[0],
                    "change_pct": 0,
                    "confidence": 0.85,
                    "description": f"Recurring payment detected: {desc} (~₹{amounts.mean():,.0f}).",
                })
    return patterns
