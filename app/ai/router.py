"""Intent router.

Fast, deterministic intent classification from the user's message. Used to
decide which tools to expose and whether financial context is required.
"""


# (regex keyword, intent)
_INTENT_RULES: list[tuple[list[str], str, list[str]]] = [
    (["price", "pricing", "charge", "mrp", "margin", "daam", "कीमत"], "business_pricing", ["analyze_expenses"]),
    (["stock", "inventory", "restock", "maal", "godown"], "business_inventory", ["analyze_expenses", "get_financial_summary"]),
    (["expand", "second machine", "another machine", "new cart", "buy a cart", "open a shop", "start a business", "start my own", "new business", "dukaan", "capital", "gadi"], "business_capital", ["calculate_cash_flow", "calculate_savings_capacity", "get_financial_summary"]),
    (["profit", "revenue", "sales", "munafa", "bikri", "kamai"], "business_summary", ["get_financial_summary", "analyze_expenses"]),
    (["emi", "equated monthly", "monthly installment"], "loan", ["simulate_loan", "calculate_emi"]),
    (["loan", "borrow", "finance", "credit", "उधार"], "loan", ["simulate_loan", "calculate_emi", "calculate_cash_flow", "calculate_debt_burden"]),
    (["save", "saving", "savings", "bacha", "bachat", "shed"], "savings", ["calculate_savings_capacity", "get_user_goals", "calculate_emergency_buffer"]),
    (["budget", "bajet"], "budget", ["analyze_expenses", "get_financial_summary"]),
    (["expense", "expenditure", "kharch", "spend", "spending", "खर्च"], "expenses", ["analyze_expenses"]),
    (["cash flow", "cashflow", "cash-flow", "nagad", "nagdina"], "cashflow", ["calculate_cash_flow", "get_financial_summary"]),
    (["debt", "karz", "rin", "khabar", "emi", "कर्ज", "ऋण"], "debt", ["calculate_debt_burden", "get_financial_summary"]),
    (["financial health", "health score", "wellbeing", "well-being", "financial wellness", "financial wellbeing"], "health", ["calculate_financial_health", "get_financial_summary"]),
    (["readiness", "credit score", "score", "credit-worthiness", "creditworthiness"], "readiness", ["calculate_credit_readiness", "get_financial_summary"]),
    (["emergency", "buffer", "emergency fund", "suraksha"], "savings", ["calculate_emergency_buffer", "calculate_savings_capacity"]),
    (["scheme", "yojana", "government", "sarkari", "subsidy", "योजना"], "schemes", ["find_government_schemes"]),
    (["summary", "overview", "financial summary", "finances"], "summary", ["get_financial_summary"]),
    (["goal", "goals", "laxya"], "goals", ["get_user_goals"]),
]

_PERSONAL_INTENTS = {
    "loan", "savings", "budget", "expenses", "cashflow", "debt",
    "readiness", "health", "summary", "goals",
    "business_pricing", "business_inventory", "business_capital", "business_summary",
}

_GENERAL_KEYWORDS = [
    "invest", "insurance", "tax", "taxation", "retirement", "bank", "banking",
    "mutual fund", "stock", "interest", "inflation", "loan meaning",
]

_LOAN_WORDS_HINDI = ["loan", "लोन", "ऋण", "कर्ज"]


def route_intent(message: str) -> dict[str, object]:
    """Return {"intent": str, "tools": [str], "needs_context": bool}."""
    lowered = message.lower()
    for keywords, intent, tools in _INTENT_RULES:
        if any(kw in lowered for kw in keywords):
            return {
                "intent": intent,
                "tools": tools,
                "needs_context": intent in _PERSONAL_INTENTS,
            }
    if any(kw in lowered for kw in _GENERAL_KEYWORDS):
        return {"intent": "general", "tools": [], "needs_context": False}
    if "मैं" in message or "मेरी" in message or "कितना" in message:
        return {
            "intent": "personal_general",
            "tools": ["get_financial_summary"],
            "needs_context": True,
        }
    return {"intent": "general", "tools": [], "needs_context": False}


def is_loan_question(message: str) -> bool:
    return any(word in message.lower() for word in _LOAN_WORDS_HINDI)
