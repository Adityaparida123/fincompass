"""Budget schemas."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class BudgetCreate(BaseModel):
    period: date
    category: str = Field(min_length=1, max_length=100)
    limit_amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)


class BudgetUpdate(BaseModel):
    limit_amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)


class BudgetRead(BaseModel):
    id: int
    period: date
    category: str
    limit_amount: Decimal

    model_config = {"from_attributes": True}


class BudgetStatus(BaseModel):
    id: int
    period: date
    category: str
    limit_amount: Decimal
    spent: Decimal
    remaining: Decimal
    percent_used: Decimal


class BudgetRecommendation(BaseModel):
    category: str
    suggested_limit: Decimal
    current_limit: Decimal | None = None
    average_spend: Decimal
    rationale: str


class BudgetRecommendations(BaseModel):
    period: date
    recommendations: list[BudgetRecommendation]
    method: str = "actuals_based"
