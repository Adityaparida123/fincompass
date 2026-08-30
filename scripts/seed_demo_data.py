"""Seed a realistic demo account with ~7 months of financial activity.

Creates (or fully resets) a demo user whose dashboard demo shows every major
feature at once: a populated financial health score, ML forecasts, savings
goals, a small debt obligation, an enriched business profile, and enough
transaction history to power FinAI's data-aware answers.

The business profile is labelled ``demo_synthetic: true`` so any downstream
code (and the docs) can distinguish demo data from real user data. All
amounts are plausible illustrative figures, NOT real customer data, and are
never passed off as such.

Usage:
    .venv/Scripts/python.exe scripts/seed_demo_data.py            # create demo@fincompass.app
    .venv/Scripts/python.exe scripts/seed_demo_data.py --reset    # delete + reseed

Environment:
    MONGODB_URI / MONGODB_DATABASE  target instance (default: repo .env)
"""

import asyncio
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

# Make the repo importable when run as a plain script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.enums import SavingsGoalStatus, TransactionSource, TransactionType  # noqa: E402
from app.db.mongo import connect, disconnect  # noqa: E402
from app.schemas.auth import RegisterRequest  # noqa: E402
from app.schemas.transaction import TransactionCreate  # noqa: E402
from app.services.auth.service import get_user_by_email, register  # noqa: E402
from app.services.finance.transactions import create_transaction  # noqa: E402
from app.services.health.service import get_current_health_score  # noqa: E402
from app.services.users.service import delete_account  # noqa: E402

stdout = getattr(sys.stdout, "buffer", None)
if stdout is not None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEMO_EMAIL = "demo@fincompass.app"
DEMO_PASSWORD = "Demo@1234"
DEMO_FULL_NAME = "Demo Store"

# Monthly rhythm for a small retail/tea-stall style business (₹).
# Seven months: income steady with one soft month; expenses controlled so the
# health score lands in the "Moderate→Good" band and leaves room to improve.
MONTH_PATTERNS = [
    (29000, 24700),
    (31000, 24000),
    (28200, 23600),
    (30500, 24300),
    (29800, 23200),
    (32500, 24800),
    (32000, 24000),
]


def _month_dates(offset_from_last: int) -> list[date]:
    """Return the month first-days for ``n`` trailing months ending this month."""
    today = date.today()
    year, month = today.year, today.month
    out: list[date] = []
    for _ in range(offset_from_last + 1):
        out.append(date(year, month, 1))
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1
    return list(reversed(out))


async def _seed_transactions(db, user_id: int) -> int:
    count = 0
    month_starts = _month_dates(len(MONTH_PATTERNS) - 1)
    for (income, expenses), first_day in zip(MONTH_PATTERNS, month_starts, strict=False):
        year, month = first_day.year, first_day.month

        def on(day: int, year: int = year, month: int = month) -> date:
            import calendar
            last = calendar.monthrange(year, month)[1]
            return date(year, month, min(day, last))

        # Income: 4 UPI sales deposits across the month.
        deposits = [
            (3, round(income * 0.28)),
            (9, round(income * 0.26)),
            (16, round(income * 0.24)),
            (23, round(income * 0.22)),
        ]
        for day, amount in deposits:
            await create_transaction(
                db,
                user_id,
                TransactionCreate(
                    date=on(day),
                    description="Daily UPI sales deposit",
                    amount=Decimal(str(amount)),
                    currency="INR",
                    transaction_type=TransactionType.income,
                    category="income",
                    subcategory="upi",
                    source=TransactionSource.upi,
                ),
            )
            count += 1

        # Expenses: the same mix every month so spending looks consistent.
        spending = [
            (4, "Shop rent", "housing", "rent", round(expenses * 0.19), TransactionSource.bank),
            (6, "Grocery and ration", "groceries", None, round(expenses * 0.26), TransactionSource.manual),
            (8, "Electricity bill", "utilities", None, round(expenses * 0.05), TransactionSource.bank),
            (10, "Stock purchase", "shopping", "stock", round(expenses * 0.28), TransactionSource.manual),
            (12, "Transport and auto", "transport", None, round(expenses * 0.06), TransactionSource.manual),
            (14, "Tea and snacks stock", "food", None, round(expenses * 0.10), TransactionSource.manual),
            (20, "Team snacks", "entertainment", None, round(expenses * 0.03), TransactionSource.manual),
            (24, "Savings transfer", "savings", None, round(expenses * 0.03), TransactionSource.manual),
        ]
        for day, desc, category, subcategory, amount, source in spending:
            await create_transaction(
                db,
                user_id,
                TransactionCreate(
                    date=on(day),
                    description=desc,
                    amount=Decimal(str(amount)),
                    currency="INR",
                    transaction_type=TransactionType.expense,
                    category=category,
                    subcategory=subcategory,
                    source=source,
                    expense_scope="business",
                ),
            )
            count += 1

        # One EMI payment mid-month.
        await create_transaction(
            db,
            user_id,
            TransactionCreate(
                date=on(18),
                description="Micro-loan EMI",
                amount=Decimal("3500"),
                currency="INR",
                transaction_type=TransactionType.expense,
                category="debt_payment",
                source=TransactionSource.bank,
                expense_scope="business",
            ),
        )
        count += 1
    return count


async def seed(*, reset: bool, print_log: bool = True) -> int:
    db = await connect()

    existing = await get_user_by_email(db, DEMO_EMAIL)
    if existing and not reset:
        print(f"Demo account already exists: {DEMO_EMAIL} (use --reset to recreate).")
        await disconnect()
        return 1
    if existing:
        counts = await delete_account(db, existing)
        print(f"Removed previous demo data: {', '.join(f'{c}:{n}' for c, n in sorted(counts.items()))}")

    user, _ = await register(
        db,
        RegisterRequest(
            email=DEMO_EMAIL,
            password=DEMO_PASSWORD,
            full_name=DEMO_FULL_NAME,
        ),
    )
    user_id = user.id

    # Enriched business profile (labelled synthetic so it is never mistaken
    # for real customer data).
    await db.update_one(
        "users",
        {"id": user_id},
        {
            "business": {
                "business_name": "Demo Tea & General Store",
                "business_type": "food",
                "business_category": "retail",
                "business_stage": "growing",
                "main_products": "Tea, snacks, daily groceries and household items",
                "village": "Sharma Nagar",
                "district": "Udaipur",
                "state": "Rajasthan",
                "started_on": "2022-11-01",
                "avg_monthly_sales": 31000,
                "avg_monthly_expenses": 24000,
                "monthly_income_estimate": 30000,
                "workers_count": 2,
                "typical_customers": "Villagers, daily workers and passing travellers",
                "seasonal": True,
                "season_note": "June to October (monsoon pull)",
                "financial_goals": ["Build a 3-month emergency buffer"],
                "business_goals": ["Open a second counter", "Buy a refrigerated display case"],
                "demo_synthetic": True,
            }
        },
    )

    tx_count = await _seed_transactions(db, user_id)

    # Savings goals (their current_amount feeds the health engine).
    await db.insert(
        "savings_goals",
        {
            "user_id": user_id,
            "name": "Emergency fund",
            "target_amount": Decimal("60000"),
            "current_amount": Decimal("22000"),
            "target_date": date(2027, 3, 31),
            "status": SavingsGoalStatus.active.value,
            "goal_type": "emergency_fund",
        },
    )
    await db.insert(
        "savings_goals",
        {
            "user_id": user_id,
            "name": "Refrigerated display case",
            "target_amount": Decimal("150000"),
            "current_amount": Decimal("30000"),
            "target_date": date(2027, 2, 28),
            "status": SavingsGoalStatus.active.value,
            "goal_type": "equipment",
        },
    )

    # One modest debt obligation so the debt + EMI features have data.
    next_month = _month_dates(1)[-1]
    import calendar
    _last = calendar.monthrange(next_month.year, next_month.month)[1]
    due = date(next_month.year, next_month.month, min(5, _last))
    await db.insert(
        "debt_obligations",
        {
            "user_id": user_id,
            "name": "Micro enterprise loan",
            "principal": Decimal("60000"),
            "monthly_payment": Decimal("3500"),
            "interest_rate": Decimal("11.0"),
            "remaining_balance": Decimal("16000"),
            "due_date": due,
        },
    )

    # Compute and persist the health score so the dashboard has it immediately.
    health = await get_current_health_score(db, user_id)

    if print_log:
        print(f"Created demo account: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print(f"  user id        : {user_id}")
        print(f"  transactions   : {tx_count}")
        print("  savings goals  : 2 (emergency fund + equipment)")
        print("  debt           : 1 micro loan (₹3,500/month)")
        print(f"  health score   : {health.score}/100 ({health.label})")
        print("  business       : Demo Tea & General Store (demo_synthetic=true)")

    await disconnect()
    return 0


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="Delete any existing demo account first.")
    args = parser.parse_args()
    return asyncio.run(seed(reset=args.reset))


if __name__ == "__main__":
    sys.exit(main())
