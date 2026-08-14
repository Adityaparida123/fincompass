"""Savings and emergency fund schemas."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.db.enums import SavingsGoalStatus


class SavingsGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    target_amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    current_amount: Decimal = Field(default=0, ge=0, max_digits=16, decimal_places=2)
    target_date: date | None = None


class SavingsGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    target_amount: Decimal | None = Field(default=None, gt=0, max_digits=16, decimal_places=2)
    current_amount: Decimal | None = Field(default=None, ge=0, max_digits=16, decimal_places=2)
    target_date: date | None = None
    status: SavingsGoalStatus | None = None


class SavingsGoalRead(BaseModel):
    id: int
    name: str
    target_amount: Decimal
    current_amount: Decimal
    target_date: date | None
    status: SavingsGoalStatus
    progress_percent: Decimal

    model_config = {"from_attributes": True}


class EmergencyBufferInput(BaseModel):
    savings: Decimal = Field(ge=0)
    essential_monthly_expenses: Decimal = Field(gt=0)


class EmergencyBufferResult(BaseModel):
    savings: Decimal
    essential_monthly_expenses: Decimal
    months_covered: Decimal
    recommended_months: int = 6
    is_adequate: bool
