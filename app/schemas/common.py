"""Common/utility schemas: pagination, envelopes, error model."""

from decimal import Decimal
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    has_next: bool


class Money(BaseModel):
    amount: Decimal = Field(gt=0, description="Monetary amount")
    currency: str = Field(default="INR", min_length=3, max_length=10)


class Message(BaseModel):
    message: str


class PeriodQuery(BaseModel):
    start_date: str | None = None
    end_date: str | None = None
