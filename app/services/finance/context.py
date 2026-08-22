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


async def _business_profile_line(db: MongoDatabase, user_id: int) -> str:
    """Short summary of the user's saved business profile (all optional)."""
    user = await db.find_one("users", {"id": user_id})
    if user is None:
        return ""
    business = getattr(user, "business", None) or {}
    if not business:
        return ""
    parts: list[str] = []
    if business.get("business_name"):
        parts.append(f"'{business['business_name']}'")
    if business.get("business_type"):
        parts.append(f"type: {business['business_type']}")
    if business.get("main_products"):
        parts.append(f"products/services: {business['main_products']}")
    location = ", ".join(
        str(business[k])
        for k in ("village", "district", "state")
        if business.get(k)
    )
    if location:
        parts.append(f"location: {location}")
    if business.get("avg_monthly_sales") is not None:
        parts.append(f"user-stated avg monthly sales: ₹{float(business['avg_monthly_sales']):,.0f}")
    if business.get("avg_monthly_expenses") is not None:
        parts.append(f"user-stated avg monthly expenses: ₹{float(business['avg_monthly_expenses']):,.0f}")
    if business.get("workers_count"):
        parts.append(f"workers: {business['workers_count']}")
    if business.get("typical_customers"):
        parts.append(f"customers: {business['typical_customers']}")
    if business.get("seasonal"):
        note = f" ({business['season_note']})" if business.get("season_note") else ""
        parts.append(f"seasonal business{note}")
    if not parts:
        return ""
    return "User's business profile (self-reported, optional fields): " + "; ".join(parts) + "."


async def build_context_for_intent(
    db: MongoDatabase,
    user_id: int,
    intent: str,
    message: str,
) -> FinancialContextSlice:
    """Retrieve only data required for the detected intent."""
    today = date.today()
    start, end = month_bounds(today.year, today.month)

    # Business profile line is included whenever the user saved one — it
    # grounds hyper-local advice. It is self-reported data, not derived.
    profile_line = await _business_profile_line(db, user_id)

    def _slice(text: str, fields: list[str]) -> FinancialContextSlice:
        combined = f"{profile_line}\n{text}".strip() if text else profile_line
        return FinancialContextSlice(text=combined, fields_included=fields)

    if intent in ("expenses", "budget"):
        category = _extract_category_hint(message)
        if category:
            total = await _category_spend(db, user_id, category, start, end)
            return _slice(
                f"Current month {category} expenses: ₹{total:,.2f} (period {start} to {end}).",
                ["category_expenses", "period"],
            )
        from app.services.finance.expenses import category_totals, expense_totals

        total, count = await expense_totals(db, user_id, start, end)
        cats = await category_totals(db, user_id, start, end)
        top = ", ".join(f"{c}: ₹{v:,.0f}" for c, v, _ in sorted(cats, key=lambda r: -r[1])[:5])
        return _slice(
            (
                f"Current month total expenses: ₹{total:,.2f} across {count} transactions. "
                f"Top categories: {top or 'none recorded'}."
            ),
            ["monthly_expenses", "categories"],
        )

    if intent in ("business_pricing", "business_inventory"):
        from app.services.finance.expenses import category_totals, expense_totals

        total, count = await expense_totals(db, user_id, start, end)
        cats = await category_totals(db, user_id, start, end)
        top = ", ".join(f"{c}: ₹{v:,.0f}" for c, v, _ in sorted(cats, key=lambda r: -r[1])[:5])
        return _slice(
            (
                f"Current month operating expenses: ₹{total:,.2f}. "
                f"Top cost categories: {top or 'none recorded'}. "
                "Use these actual costs when discussing pricing or stock decisions; "
                "label any suggestion as an estimate."
            ),
            ["operating_expenses", "cost_categories"],
        )

    if intent == "business_capital":
        from app.services.readiness.factors import build_readiness_input

        data = await build_readiness_input(db, user_id)
        surplus = data.income - data.total_expenses - data.debt_payments
        return _slice(
            (
                f"Monthly income ~₹{data.income:,.0f}; expenses ~₹{data.total_expenses:,.0f}; "
                f"debt payments ~₹{data.debt_payments:,.0f}; estimated monthly surplus ~₹{max(surplus, 0):,.0f}; "
                f"savings balance ~₹{data.savings:,.0f}. "
                "Use these figures when discussing affordability of a purchase or expansion; "
                "clearly label conclusions as estimates."
            ),
            ["income", "expenses", "debt_payments", "surplus", "savings"],
        )

    if intent == "business_summary":
        from app.services.readiness.factors import build_readiness_input

        data = await build_readiness_input(db, user_id)
        profit = data.income - data.total_expenses - data.debt_payments
        return _slice(
            (
                f"This month: income ~₹{data.income:,.0f}; expenses ~₹{data.total_expenses:,.0f}; "
                f"estimated profit after debt payments ~₹{profit:,.0f}."
            ),
            ["income", "expenses", "profit"],
        )

    if intent in ("savings",):
        from app.services.readiness.factors import build_readiness_input

        data = await build_readiness_input(db, user_id)
        return _slice(
            (
                f"Estimated monthly savings capacity based on recorded data: "
                f"₹{max(data.income - data.total_expenses - data.debt_payments, 0):,.0f}. "
                f"Current savings balance (goals): ₹{data.savings:,.0f}."
            ),
            ["savings_capacity", "savings_balance"],
        )

    if intent in ("loan", "emi", "debt"):
        from app.services.readiness.factors import build_readiness_input

        data = await build_readiness_input(db, user_id)
        return _slice(
            (
                f"Monthly income ~₹{data.income:,.0f}; debt payments ~₹{data.debt_payments:,.0f}; "
                f"essential expenses ~₹{data.essential_monthly_expenses:,.0f}."
            ),
            ["income", "debt_payments", "essential_expenses"],
        )

    if intent == "readiness":
        from app.services.readiness.service import get_current_readiness

        result = await get_current_readiness(db, user_id)
        factors = "; ".join(f"{f.name}: {f.explanation}" for f in result.factors[:4])
        return _slice(
            f"Business credit readiness score: {result.score}/100. Key factors: {factors}.",
            ["readiness_score", "readiness_factors"],
        )

    if profile_line:
        # Schemes / goals / other personal intents still benefit from the profile.
        return FinancialContextSlice(text=profile_line, fields_included=["business_profile"])

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
