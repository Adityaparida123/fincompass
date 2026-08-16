"""Movement-type classification for imported statement rows.

Distinguishes transfers, cash movements, refunds, fees and interest from
ordinary spending/income so that, e.g., a savings-to-savings transfer is never
counted as consumption. The result is informational (``movement_type`` on the
preview); the canonical transaction model keeps storing income/expense.

Rule order matters: specific patterns (cash, refunds, fees) win over generic
transfer signals, and a transfer signal on a clear spending category (rent,
utilities, ...) is treated as a bill payment, not a transfer.
"""

from __future__ import annotations

import re

# Categories that clearly indicate a purchase/bill even when the narration
# carries transfer plumbing (e.g. "NEFT ... RENT", "IMPS ... ELECTRICITY").
_SPENDING_CATEGORIES = frozenset({
    "food",
    "groceries",
    "transport",
    "housing",
    "utilities",
    "healthcare",
    "education",
    "shopping",
    "entertainment",
    "subscriptions",
})

_CASH_WITHDRAWAL = re.compile(
    r"\b(atm|cash withdrawal|cash withdraw|cash out)\b|withdraw(?:al)?[^a-z]*cash|cash[^a-z]*withdraw",
    re.IGNORECASE,
)
_CASH_DEPOSIT = re.compile(r"\b(cash deposit|cash deposited|cash in|cash drop)\b", re.IGNORECASE)
_REFUND = re.compile(
    r"\b(refund|reversal|cashback|money back|charge back|credit back)\b",
    re.IGNORECASE,
)
_FEE = re.compile(
    r"\b(bank charges?|service charges?|transaction charges?|processing fees?|"
    r"annual fees?|card fees?|penalt(?:y|ies)|late fees?|maintenance fees?|"
    r"ledger charges?|commissions?|surcharges?|joining fees?|account charges?)\b",
    re.IGNORECASE,
)
_INTEREST = re.compile(
    r"\b(interest|dividend|int\.?( credit|earned|paid)?|interest earned|interest credit)\b",
    re.IGNORECASE,
)
_OWN_ACCOUNT = re.compile(r"\b(own account|self account|to self|transfer to self|saving.*self)\b", re.IGNORECASE)
_CREDIT_CARD = re.compile(r"\b(credit card|card payment|cc bill|credit card bill)\b", re.IGNORECASE)
_TRANSFER = re.compile(
    r"\b(transfer|fund transfer|imps|neft|rtgs|nach|aeps|billpay|bill pay|"
    r"trf|a2a|p2a)\b|credit card payment",
    re.IGNORECASE,
)


def classify_movement(description: str, transaction_type: str, category: str) -> tuple[str, bool]:
    """Return ``(movement_type, needs_review)`` for a normalized row."""
    text = description or ""
    cat = (category or "").lower()

    if _CASH_WITHDRAWAL.search(text):
        return "cash_withdrawal", False
    if _CASH_DEPOSIT.search(text):
        return "cash_deposit", False
    if _REFUND.search(text):
        return "refund", False
    if _INTEREST.search(text):
        return "interest", False
    if _FEE.search(text):
        return "fee", False

    if _OWN_ACCOUNT.search(text) or _CREDIT_CARD.search(text):
        return "transfer", False

    if (transaction_type or "").lower() == "income":
        # Incoming money via NEFT/IMPS/UPI is income (salary, payments), not a
        # transfer; only self-transfers above are treated as transfers.
        return "income", False

    if _TRANSFER.search(text):
        if cat in _SPENDING_CATEGORIES:
            # A bill/invoice paid via transfer plumbing is still spending.
            return transaction_type or "expense", False
        return "transfer", True

    return transaction_type or "unknown", False
