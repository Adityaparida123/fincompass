"""Cash flow and savings capacity endpoints (deterministic financial engine)."""

from fastapi import APIRouter

from app.schemas.cashflow import (
    CashFlowInput,
    CashFlowResult,
    SavingsCapacityInput,
    SavingsCapacityResult,
)
from app.services.finance.cashflow import calculate_cash_flow, calculate_savings_capacity

router = APIRouter(prefix="/cashflow", tags=["cashflow"])


@router.post("/calculate", response_model=CashFlowResult)
async def cash_flow(data: CashFlowInput) -> CashFlowResult:
    return calculate_cash_flow(data)


@router.post("/savings-capacity", response_model=SavingsCapacityResult)
async def savings_capacity(data: SavingsCapacityInput) -> SavingsCapacityResult:
    return calculate_savings_capacity(data)
