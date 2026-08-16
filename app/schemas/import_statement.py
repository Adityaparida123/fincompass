"""Bank statement import schemas.

The analyze endpoint returns a reviewable preview (nothing is written to the
database). The confirm endpoint persists the transactions the user explicitly
selected, optionally with their edits applied.
"""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.db.enums import TransactionType

MAX_IMPORT_ROWS = 2000

# Confidence tiers for AI-assisted categorization (spec: 11).
CONFIDENCE_HIGH = 0.95
CONFIDENCE_GOOD = 0.80
CONFIDENCE_REVIEW = 0.60

# Movement types produced by the classification stage. Only income/expense is
# persisted (the canonical transaction model); the rest guide review, dedup and
# analytics so transfers/refunds/cash movements are never counted as spending.
MOVEMENT_TYPES = (
    "income",
    "expense",
    "transfer",
    "cash_withdrawal",
    "cash_deposit",
    "refund",
    "fee",
    "interest",
    "unknown",
)


class StatementPreviewTransaction(BaseModel):
    row_number: int
    date: date
    description: str
    amount: Decimal
    transaction_type: TransactionType
    category: str
    subcategory: str | None = None
    merchant: str | None = None
    movement_type: str = "unknown"
    confidence: float = 0.0
    confidence_label: str = "low"
    needs_review: bool = True
    category_source: str = "ml"
    duplicate_status: str = "new"  # "new" | "possible_duplicate" | "duplicate"
    is_duplicate: bool = False
    recurring: bool = False
    warnings: list[str] = Field(default_factory=list)
    reference: str | None = None


class StatementAnalyzeResponse(BaseModel):
    file_name: str
    total_rows: int
    new_count: int = 0
    expenses_count: int
    income_count: int
    duplicate_count: int
    possible_duplicate_count: int = 0
    needs_review_count: int
    recurring_count: int = 0
    skipped_rows: int = 0
    transactions: list[StatementPreviewTransaction]
    message: str | None = None


class StatementConfirmItem(BaseModel):
    date: date
    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    transaction_type: TransactionType
    category: str = Field(min_length=1, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)
    merchant: str | None = Field(default=None, max_length=200)


class StatementConfirmRequest(BaseModel):
    transactions: list[StatementConfirmItem] = Field(
        min_length=1, max_length=MAX_IMPORT_ROWS
    )


class StatementConfirmResponse(BaseModel):
    imported_count: int
    duplicates_skipped: int
