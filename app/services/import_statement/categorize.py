"""Transaction categorization for imported rows.

Deterministic keyword rules take precedence (high confidence, no review
needed). Everything else falls back to the existing on-device ML classifier
(``app.services.ml.service.categorize_transaction``) so categorization stays
consistent with the rest of the app. Statement contents never leave the server.

Confidence tiers (spec: 11):

    0.95-1.00  high
    0.80-0.94  good
    0.60-0.79  needs review
    <0.60      unknown / manual review
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.schemas.import_statement import (
    CONFIDENCE_GOOD,
    CONFIDENCE_HIGH,
    CONFIDENCE_REVIEW,
)
from app.services.ml.service import categorize_transaction
from ml.config import TRANSACTION_CATEGORIES

_VOCAB = set(TRANSACTION_CATEGORIES)


@dataclass
class CategoryResult:
    category: str
    confidence: float
    confidence_label: str
    needs_review: bool
    subcategory: str | None = None
    source: str = "ml"


def confidence_tier(confidence: float) -> tuple[str, bool]:
    """Map a score to (label, needs_review) per the spec's tiers."""
    if confidence >= CONFIDENCE_HIGH:
        return "high", False
    if confidence >= CONFIDENCE_GOOD:
        return "good", False
    if confidence >= CONFIDENCE_REVIEW:
        return "medium", True
    return "low", True


# Ordered so specific keywords win over broad ones (subscriptions before
# entertainment, debt payments before shopping, etc.).
# Each entry: (keywords, category, subcategory)
_KEYWORD_RULES: list[tuple[tuple[str, ...], str, str | None]] = [
    (("salary", "monthly salary", "wages", "stipend", "pension"), "income", "payroll"),
    (("refund", "reversal", "cashback", "dividend", "bonus", "award"), "income", "refund"),
    (("interest credit", "interest received", "interest earned", "int credit"), "income", "interest"),
    (("upi credit", "upi/credit", "money received", "received from"), "income", "upi"),
    (("loan", "emi", "credit card bill", "credit card payment", "card payment", "emi auto debit"), "debt_payment", "loan"),
    (("subscription", "membership", "netflix", "spotify", "amazon prime", "youtube premium", "hotstar", "sony liv"), "subscriptions", "streaming"),
    (("swiggy", "zomato", "restaurant", "cafe", "coffee", "dominos", "kfc", "mcdonald", "pizza", "lunch", "dinner", "breakfast", "biryani", "ubereats", "eat"), "food", "restaurant"),
    (("grocery", "groceries", "supermarket", "bigbasket", "dmart", "blinkit", "zepto", "instamart", "reliance fresh", "provision"), "groceries", "groceries"),
    (("uber", "ola", "rapido", "petrol", "diesel", "fuel", "cng", "metro", "bus", "train ticket", "auto", "fuel station"), "transport", "ride_hailing"),
    (("rent", "lease", "maintenance charge", "society maintenance"), "housing", "rent"),
    (("electricity", "water bill", "gas bill", "broadband", "internet", "mobile recharge", "recharge", "airtel", "jio", "bsnl", "utility", "tneb", "electric bill"), "utilities", "utility_bill"),
    (("hospital", "doctor", "pharmacy", "medical", "clinic", "medicine", "medicines", "apollo", "diagnostic", "labs", "health"), "healthcare", "medical"),
    (("school", "college", "tuition", "course", "udemy", "coursera", "books", "education", "coaching", "fees", "exam"), "education", "education"),
    (("amazon", "flipkart", "myntra", "ajio", "mall", "clothing", "electronics", "shopping", "retail"), "shopping", "online"),
    (("movie", "cinema", "theatre", "theater", "game", "gaming", "entertainment", "party", "concert"), "entertainment", "entertainment"),
    (("savings", "sip", "mutual fund", "fixed deposit", "fd", "deposit scheme", "nps", "ppf"), "savings", "investment"),
    (("insurance", "premium", "lic", "policy"), "insurance", "insurance"),
    (("investment", "stocks", "shares", "demat", "bonds"), "savings", "investment"),
]


def _rule_lookup(description: str, transaction_type: str) -> tuple[str, str | None, str] | None:
    text = description.strip().lower()
    for keywords, category, subcategory in _KEYWORD_RULES:
        for keyword in keywords:
            if keyword in text:
                return category, subcategory, "keyword"
    if transaction_type == "income":
        return "income", None, "keyword"
    return None


async def _run_ml(description: str, amount: Decimal, transaction_type: str) -> dict | None:
    """Reuse the on-device classifier; a model artifact problem must never
    fail the whole import."""
    try:
        return await categorize_transaction(description, amount, transaction_type)
    except Exception:
        return None


async def categorize_row(description: str, amount: Decimal, transaction_type: str) -> CategoryResult:
    rule = _rule_lookup(description, transaction_type)
    if rule is not None:
        category, subcategory, source = rule
        return CategoryResult(
            category=category,
            confidence=0.95,
            confidence_label="high",
            needs_review=False,
            subcategory=subcategory,
            source=source,
        )

    result = await _run_ml(description, amount, transaction_type)
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
    label, needs_review = confidence_tier(confidence)
    return CategoryResult(
        category=category,
        confidence=round(confidence, 3),
        confidence_label=label,
        needs_review=needs_review,
        source="ml",
    )
