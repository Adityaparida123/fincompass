"""Debt schemas."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class DebtObligationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    principal: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    monthly_payment: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    interest_rate: Decimal = Field(ge=0, max_digits=8, decimal_places=4)
    remaining_balance: Decimal = Field(ge=0, max_digits=16, decimal_places=2)
    due_date: date | None = None


class DebtObligationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    principal: Decimal | None = Field(default=None, gt=0, max_digits=16, decimal_places=2)
    monthly_payment: Decimal | None = Field(default=None, gt=0, max_digits=16, decimal_places=2)
    interest_rate: Decimal | None = Field(default=None, ge=0, max_digits=8, decimal_places=4)
    remaining_balance: Decimal | None = Field(default=None, ge=0, max_digits=16, decimal_places=2)
    due_date: date | None = None


class DebtObligationRead(BaseModel):
    id: int
    name: str
    principal: Decimal
    monthly_payment: Decimal
    interest_rate: Decimal
    remaining_balance: Decimal
    due_date: date | None

    model_config = {"from_attributes": True}


class DebtBurdenInput(BaseModel):
    monthly_income: Decimal = Field(gt=0)
    monthly_debt_payments: Decimal = Field(ge=0)


class DebtBurdenResult(BaseModel):
    monthly_income: Decimal
    monthly_debt_payments: Decimal
    debt_payment_ratio: Decimal
    context_note: str
