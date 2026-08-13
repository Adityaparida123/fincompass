"""Generate realistic synthetic financial data for development and demos.

Do NOT use real people's financial information.
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from ml.config import SYNTHETIC_DIR, TRANSACTION_CATEGORIES

RNG = np.random.default_rng(42)

CATEGORY_DESCRIPTIONS: dict[str, list[str]] = {
    "food": ["restaurant", "cafe lunch", "dinner out", "food delivery", "street food"],
    "groceries": ["supermarket", "grocery store", "vegetables market", "daily needs"],
    "transport": ["uber ride", "metro card", "fuel petrol", "auto rickshaw", "bus pass"],
    "housing": ["rent payment", "maintenance fee", "society charges"],
    "utilities": ["electricity bill", "water bill", "internet broadband", "mobile recharge"],
    "healthcare": ["pharmacy", "doctor visit", "lab test", "health insurance premium"],
    "education": ["course fee", "books", "online learning", "tuition"],
    "shopping": ["amazon purchase", "clothing store", "electronics", "online shopping"],
    "entertainment": ["movie tickets", "streaming", "concert", "gaming"],
    "subscriptions": ["netflix", "spotify", "gym membership", "cloud storage"],
    "debt_payment": ["loan emi", "credit card payment", "personal loan"],
    "savings": ["mutual fund sip", "fixed deposit", "recurring deposit"],
    "income": ["salary credit", "freelance payment", "bonus", "interest income"],
    "other": ["miscellaneous", "cash withdrawal", "transfer", "unknown merchant"],
}

CATEGORY_AMOUNT_RANGES: dict[str, tuple[int, int]] = {
    "food": (150, 1200),
    "groceries": (300, 3500),
    "transport": (50, 800),
    "housing": (8000, 25000),
    "utilities": (200, 3000),
    "healthcare": (200, 5000),
    "education": (500, 15000),
    "shopping": (500, 8000),
    "entertainment": (200, 2500),
    "subscriptions": (99, 1500),
    "debt_payment": (3000, 12000),
    "savings": (2000, 15000),
    "income": (35000, 85000),
    "other": (100, 2000),
}


def _generate_user_profile(user_idx: int) -> dict:
    income = int(RNG.integers(30000, 80000))
    return {
        "user_id": f"synthetic_{user_idx:03d}",
        "monthly_income": income,
        "monthly_expenses_target": int(income * RNG.uniform(0.55, 0.85)),
        "savings_balance": int(RNG.integers(5000, 80000)),
        "debt_obligations": int(RNG.integers(0, 15000)),
    }


def _pick_category(is_income: bool) -> str:
    if is_income:
        return "income"
    weights = {
        "food": 0.15,
        "groceries": 0.12,
        "transport": 0.10,
        "housing": 0.08,
        "utilities": 0.07,
        "healthcare": 0.04,
        "education": 0.03,
        "shopping": 0.12,
        "entertainment": 0.06,
        "subscriptions": 0.05,
        "debt_payment": 0.06,
        "savings": 0.04,
        "other": 0.08,
    }
    cats = list(weights.keys())
    probs = np.array([weights[c] for c in cats])
    probs /= probs.sum()
    return str(RNG.choice(cats, p=probs))


def generate_transactions(
    user_id: str,
    start: date,
    months: int = 6,
    transactions_per_month: int = 40,
) -> pd.DataFrame:
    records: list[dict] = []
    current = start
    end = start + timedelta(days=months * 30)

    while current < end:
        for _ in range(transactions_per_month // 30 + 1):
            is_income = current.day in (1, 2) and RNG.random() < 0.3
            category = _pick_category(is_income)
            lo, hi = CATEGORY_AMOUNT_RANGES[category]
            amount = float(RNG.integers(lo, hi))
            desc = str(RNG.choice(CATEGORY_DESCRIPTIONS[category]))
            tx_type = "income" if category == "income" else "expense"

            records.append({
                "user_id": user_id,
                "date": current.isoformat(),
                "amount": amount,
                "type": tx_type,
                "category": category,
                "description": desc,
                "day_of_week": current.weekday(),
            })
        current += timedelta(days=1)

    return pd.DataFrame(records)


def generate_synthetic_dataset(
    num_users: int = 50,
    output_dir: Path | None = None,
) -> dict[str, Path]:
    """Generate users, transactions, debts, savings, and budgets."""
    output_dir = output_dir or SYNTHETIC_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    start = date(2026, 2, 1)
    users: list[dict] = []
    all_transactions: list[pd.DataFrame] = []
    debts: list[dict] = []
    savings: list[dict] = []
    budgets: list[dict] = []

    for i in range(1, num_users + 1):
        profile = _generate_user_profile(i)
        users.append(profile)
        tx_df = generate_transactions(profile["user_id"], start)
        all_transactions.append(tx_df)

        if profile["debt_obligations"] > 0:
            debts.append({
                "user_id": profile["user_id"],
                "principal": profile["debt_obligations"] * 12,
                "monthly_payment": profile["debt_obligations"],
                "interest_rate": round(float(RNG.uniform(8, 18)), 2),
            })

        savings.append({
            "user_id": profile["user_id"],
            "balance": profile["savings_balance"],
            "monthly_contribution": int(profile["monthly_income"] * 0.1),
        })

        for cat in ["food", "groceries", "transport", "shopping"]:
            budgets.append({
                "user_id": profile["user_id"],
                "category": cat,
                "limit_amount": int(RNG.integers(2000, 8000)),
                "period": "monthly",
            })

    users_df = pd.DataFrame(users)
    tx_df = pd.concat(all_transactions, ignore_index=True)
    debts_df = pd.DataFrame(debts) if debts else pd.DataFrame(columns=["user_id"])
    savings_df = pd.DataFrame(savings)
    budgets_df = pd.DataFrame(budgets)

    paths = {
        "users": output_dir / "users.csv",
        "transactions": output_dir / "transactions.csv",
        "debts": output_dir / "debts.csv",
        "savings": output_dir / "savings.csv",
        "budgets": output_dir / "budgets.csv",
    }
    users_df.to_csv(paths["users"], index=False)
    tx_df.to_csv(paths["transactions"], index=False)
    debts_df.to_csv(paths["debts"], index=False)
    savings_df.to_csv(paths["savings"], index=False)
    budgets_df.to_csv(paths["budgets"], index=False)

    meta = {
        "num_users": num_users,
        "num_transactions": len(tx_df),
        "categories": TRANSACTION_CATEGORIES,
        "generated_at": date.today().isoformat(),
        "demo_user": "synthetic_001",
    }
    meta_path = output_dir / "metadata.json"
    meta_path.write_text(json.dumps(meta, indent=2))

    return paths


def generate_demo_user() -> dict:
    """Create the hackathon demo scenario user data."""
    demo_tx = []
    start = date(2026, 2, 1)
    user_id = "synthetic_demo"

    base_expenses = {
        "food": 4500,
        "groceries": 3500,
        "transport": 2000,
        "housing": 12000,
        "utilities": 2500,
        "shopping": 3000,
        "entertainment": 1500,
        "subscriptions": 800,
        "debt_payment": 6000,
    }

    for month_offset in range(6):
        month_start = start + timedelta(days=month_offset * 30)
        food_mult = 1.0 + (month_offset * 0.03)
        shop_mult = 1.0 + (month_offset * 0.05)

        for day in range(28):
            d = month_start + timedelta(days=day)
            if d.day == 1:
                demo_tx.append({
                    "user_id": user_id,
                    "date": d.isoformat(),
                    "amount": 50000.0,
                    "type": "income",
                    "category": "income",
                    "description": "salary credit",
                    "day_of_week": d.weekday(),
                })
            for cat, base in base_expenses.items():
                if RNG.random() < 0.15:
                    mult = food_mult if cat == "food" else shop_mult if cat == "shopping" else 1.0
                    amount = base / 8 * mult * RNG.uniform(0.7, 1.3)
                    demo_tx.append({
                        "user_id": user_id,
                        "date": d.isoformat(),
                        "amount": round(amount, 2),
                        "type": "expense",
                        "category": cat,
                        "description": RNG.choice(CATEGORY_DESCRIPTIONS[cat]),
                        "day_of_week": d.weekday(),
                    })

    return {
        "user_id": user_id,
        "monthly_income": 50000,
        "monthly_expenses": 36000,
        "savings": 8000,
        "debt_obligations": 6000,
        "transactions": pd.DataFrame(demo_tx),
    }


if __name__ == "__main__":
    paths = generate_synthetic_dataset(num_users=50)
    print("Generated synthetic data:")
    for name, path in paths.items():
        print(f"  {name}: {path}")
