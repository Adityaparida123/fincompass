"""Business vs personal expense classification.

Derives an ``expense_scope`` ("business" | "personal" | "mixed") from a
transaction's category so the product can separate shop money from household
money without changing the ML categorization vocabulary (the trained
classifier keeps its fixed label set).

A user-provided override stored on the transaction (``expense_scope`` field,
values "business"/"personal") always wins over the derived classification.
"""

from __future__ import annotations

SCOPE_BUSINESS = "business"
SCOPE_PERSONAL = "personal"
SCOPE_MIXED = "mixed"

# Categories that are almost always business costs for a microentrepreneur.
BUSINESS_CATEGORIES = frozenset({
    "inventory",
    "raw_materials",
    "business_rent",
    "equipment",
    "marketing",
    "supplier_payment",
    "labor",
    "packaging",
    "business_supplies",
})

# Categories that are almost always household/personal costs.
PERSONAL_CATEGORIES = frozenset({
    "food",
    "groceries",
    "healthcare",
    "education",
    "shopping",
    "entertainment",
    "subscriptions",
})

# Categories that could legitimately be either (shop electricity vs home
# electricity) and should be surfaced as "possibly mixed".
MIXED_CATEGORIES = frozenset({
    "transport",
    "housing",
    "utilities",
    "insurance",
    "other",
})


def classify_scope(category: str) -> str:
    """Map a category to its likely expense scope."""
    normalized = category.strip().lower()
    if normalized in BUSINESS_CATEGORIES:
        return SCOPE_BUSINESS
    if normalized in PERSONAL_CATEGORIES:
        return SCOPE_PERSONAL
    return SCOPE_MIXED


def resolve_scope(category: str, override: str | None) -> str:
    """Resolve the effective scope, honouring a user override."""
    if override in (SCOPE_BUSINESS, SCOPE_PERSONAL):
        return override
    return classify_scope(category)
