"""Minimal financial context retrieval for FinAI (privacy-first)."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.db.enums import TransactionType
from app.db.mongo import MongoDatabase
from app.utils.dates import month_bounds


@dataclass
class FinancialContextSlice:
    """Minimal context payload for LLM grounding."""

    text: str
    fields_included: list[str]


async def _category_spend(
    db: MongoDatabase, user_id: int, category: str, start: date, end: date
) -> Decimal:
    filt = {
        "user_id": user_id,
        "transaction_type": TransactionType.expense.value,
        "is_deleted": False,
        "category": category,
        "date": {"$gte": start, "$lt": end},
    }
    return await db.sum_field("transactions", filt, "amount")


async def build_context_for_intent(
    db: MongoDatabase,
    user_id: int,
    intent: str,
    message: str,
) -> FinancialContextSlice:
    """Retrieve only data required for the detected intent."""
    today = date.today()
    start, end = month_bounds(today.year, today.month)

    if intent in ("expenses", "budget"):
        category = _extract_category_hint(message)
        if category:
            total = await _category_spend(db, user_id, category, start, end)
            return FinancialContextSlice(
                text=f"Current month {category} expenses: ₹{total:,.2f} (period {start} to {end}).",
                fields_included=["category_expenses", "period"],
            )
        from app.services.finance.expenses import category_totals, expense_totals

        total, count = await expense_totals(db, user_id, start, end)
        cats = await category_totals(db, user_id, start, end)
        top = ", ".join(f"{c}: ₹{v:,.0f}" for c, v, _ in sorted(cats, key=lambda r: -r[1])[:5])
        return FinancialContextSlice(
            text=(
                f"Current month total expenses: ₹{total:,.2f} across {count} transactions. "
                f"Top categories: {top or 'none recorded'}."
            ),
            fields_included=["monthly_expenses", "categories"],
        )

    if intent in ("savings",):
        from app.services.readiness.factors import build_readiness_input

        data = await build_readiness_input(db, user_id)
        return FinancialContextSlice(
            text=(
                f"Estimated monthly savings capacity based on recorded data: "
                f"₹{max(data.income - data.total_expenses - data.debt_payments, 0):,.0f}. "
                f"Current savings balance (goals): ₹{data.savings:,.0f}."
            ),
            fields_included=["savings_capacity", "savings_balance"],
        )

    if intent in ("loan", "emi", "debt"):
        from app.services.readiness.factors import build_readiness_input

        data = await build_readiness_input(db, user_id)
        return FinancialContextSlice(
            text=(
                f"Monthly income ~₹{data.income:,.0f}; debt payments ~₹{data.debt_payments:,.0f}; "
                f"essential expenses ~₹{data.essential_monthly_expenses:,.0f}."
            ),
            fields_included=["income", "debt_payments", "essential_expenses"],
        )

    if intent == "readiness":
        from app.services.readiness.service import get_current_readiness

        result = await get_current_readiness(db, user_id)
        factors = "; ".join(f"{f.name}: {f.explanation}" for f in result.factors[:4])
        return FinancialContextSlice(
            text=f"Credit readiness score: {result.score}/100. Key factors: {factors}.",
            fields_included=["readiness_score", "readiness_factors"],
        )

    # General / schemes / unknown — no personal financial data.
    return FinancialContextSlice(text="", fields_included=[])


def _extract_category_hint(message: str) -> str | None:
    lower = message.lower()
    hints = {
        "food": ["food", "grocer", "restaurant", "खाना", "grocery"],
        "rent": ["rent", "housing", "किराया"],
        "transport": ["transport", "fuel", "uber", "ola", "travel"],
        "utilities": ["utility", "electric", "water", "internet", "bill"],
        "subscription": ["subscription", "netflix", "spotify"],
        "emi": ["emi", "loan payment"],
        "salary": ["salary", "income", "वेतन"],
    }
    for category, keywords in hints.items():
        if any(k in lower for k in keywords):
            return category
    return None
