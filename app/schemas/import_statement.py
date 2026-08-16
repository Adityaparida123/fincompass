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


class StatementPreviewTransaction(BaseModel):
    row_number: int
    date: date
    description: str
    amount: Decimal
    transaction_type: TransactionType
    category: str
    confidence: float = 0.0
    confidence_label: str = "low"
    needs_review: bool = True
    category_source: str = "ml"
    is_duplicate: bool = False
    reference: str | None = None


class StatementAnalyzeResponse(BaseModel):
    file_name: str
    total_rows: int
    expenses_count: int
    income_count: int
    duplicate_count: int
    needs_review_count: int
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


class StatementConfirmRequest(BaseModel):
    transactions: list[StatementConfirmItem] = Field(
        min_length=1, max_length=MAX_IMPORT_ROWS
    )


class StatementConfirmResponse(BaseModel):
    imported_count: int
    duplicates_skipped: int
