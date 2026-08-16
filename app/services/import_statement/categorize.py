"""Transaction categorization for imported rows.

Deterministic keyword rules take precedence (high confidence, no review
needed). Everything else falls back to the existing on-device ML classifier
(``app.services.ml.service.categorize_transaction``) so categorization stays
consistent with the rest of the app. Statement contents never leave the server.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.services.ml.service import categorize_transaction
from ml.config import LOW_CONFIDENCE_THRESHOLD, TRANSACTION_CATEGORIES

_VOCAB = set(TRANSACTION_CATEGORIES)


@dataclass
class CategoryResult:
    category: str
    confidence: float
    confidence_label: str
    needs_review: bool
    source: str = "ml"


# Ordered so specific keywords win over broad ones (subscriptions before
# entertainment, debt payments before shopping, etc.).
_KEYWORD_RULES: list[tuple[tuple[str, ...], str]] = [
    (("salary", "monthly salary", "wages", "stipend", "pension"), "income"),
    (("refund", "reversal", "cashback", "dividend", "interest credit", "bonus", "award"), "income"),
    (("upi credit", "upi/credit", "money received", "received from"), "income"),
    (("loan", "emi", "credit card bill", "credit card payment", "card payment", "emi auto debit"), "debt_payment"),
    (("subscription", "membership", "netflix", "spotify", "amazon prime", "youtube premium", "hotstar", "sony liv"), "subscriptions"),
    (("swiggy", "zomato", "restaurant", "food", "cafe", "coffee", "dominos", "kfc", "mcdonald", "pizza", "lunch", "dinner", "breakfast", "biryani", "ubereats", "eat"), "food"),
    (("grocery", "groceries", "supermarket", "bigbasket", "dmart", "blinkit", "zepto", "instamart", "reliance fresh", "provision"), "groceries"),
    (("uber", "ola", "rapido", "petrol", "diesel", "fuel", "cng", "metro", "bus", "train ticket", "auto", "fuel station"), "transport"),
    (("rent", "lease", "maintenance charge", "society maintenance"), "housing"),
    (("electricity", "water bill", "gas bill", "broadband", "internet", "mobile recharge", "recharge", "airtel", "jio", "bsnl", "utility", "tneb", "electric bill"), "utilities"),
    (("hospital", "doctor", "pharmacy", "medical", "clinic", "medicine", "medicines", "apollo", "diagnostic", "labs", "health"), "healthcare"),
    (("school", "college", "tuition", "course", "udemy", "coursera", "books", "education", "coaching", "fees", "exam"), "education"),
    (("amazon", "flipkart", "myntra", "ajio", "mall", "clothing", "electronics", "shopping", "retail"), "shopping"),
    (("movie", "cinema", "theatre", "theater", "game", "gaming", "entertainment", "party", "concert"), "entertainment"),
    (("savings", "sip", "mutual fund", "fixed deposit", "fd", "deposit scheme", "nps", "ppf"), "savings"),
]


def _rule_lookup(description: str, transaction_type: str) -> tuple[str, str] | None:
    text = description.strip().lower()
    for keywords, category in _KEYWORD_RULES:
        for keyword in keywords:
            if keyword in text:
                return category, "keyword"
    if transaction_type == "income":
        return "income", "keyword"
    return None


async def categorize_row(description: str, amount: Decimal, transaction_type: str) -> CategoryResult:
    rule = _rule_lookup(description, transaction_type)
    if rule is not None:
        category, source = rule
        return CategoryResult(
            category=category,
            confidence=0.95,
            confidence_label="high",
            needs_review=False,
            source=source,
        )

    try:
        result = await categorize_transaction(description, amount, transaction_type)
    except Exception:
        result = None

    if result is None or not result.get("prediction", {}).get("value"):
        return CategoryResult(
            category="other",
            confidence=0.0,
            confidence_label="low",
            needs_review=True,
            source="ml",
        )

    prediction = result["prediction"]
    category = str(prediction.get("value", "other"))
    if category not in _VOCAB:
        category = "other"
    confidence = float(prediction.get("confidence", 0.0))
    label = str(prediction.get("confidence_label", "low"))
    needs_review = bool(prediction.get("needs_review", True)) or confidence < LOW_CONFIDENCE_THRESHOLD
    return CategoryResult(
        category=category,
        confidence=round(confidence, 3),
        confidence_label=label,
        needs_review=needs_review,
        source="ml",
    )
