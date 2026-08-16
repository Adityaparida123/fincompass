"""Transaction schemas."""

from datetime import date as date_type
from decimal import Decimal

from pydantic import BaseModel, Field

from app.db.enums import TransactionSource, TransactionType

ESSENTIAL_CATEGORIES = {
    "housing",
    "rent",
    "groceries",
    "utilities",
    "transport",
    "healthcare",
    "education",
    "insurance",
    "food",
}


class TransactionCreate(BaseModel):
    date: date_type
    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    transaction_type: TransactionType
    category: str = Field(min_length=1, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)
    merchant: str | None = Field(default=None, max_length=200)
    source: TransactionSource = TransactionSource.manual
    currency: str = Field(default="INR", min_length=3, max_length=10)


class TransactionUpdate(BaseModel):
    date: date_type | None = None
    description: str | None = Field(default=None, min_length=1, max_length=500)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=16, decimal_places=2)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)
    merchant: str | None = Field(default=None, max_length=200)
    currency: str | None = Field(default=None, min_length=3, max_length=10)


class TransactionRead(BaseModel):
    id: int
    date: date_type
    description: str
    amount: Decimal
    currency: str
    transaction_type: TransactionType
    category: str
    subcategory: str | None
    merchant: str | None = None
    source: TransactionSource

    model_config = {"from_attributes": True}


def is_essential(category: str) -> bool:
    return category.strip().lower() in ESSENTIAL_CATEGORIES
