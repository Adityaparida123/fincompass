"""Loan tools: EMI calculator and loan simulator."""

from fastapi import APIRouter

from app.schemas.loan import (
    AffordabilityInput,
    AffordabilityResult,
    EMICalculateRequest,
    EMIResult,
    LoanSimulationRequest,
    LoanSimulationResult,
)
from app.services.lending.affordability import assess_affordability
from app.services.lending.emi import emi_result
from app.services.lending.loan_simulator import simulate_loan

router = APIRouter(prefix="/tools", tags=["loan tools"])


@router.post("/emi", response_model=EMIResult)
async def calculate_emi(data: EMICalculateRequest) -> EMIResult:
    return emi_result(data.principal, data.annual_interest_rate, data.tenure_months)


@router.post("/loan-simulation", response_model=LoanSimulationResult)
async def loan_simulation(data: LoanSimulationRequest) -> LoanSimulationResult:
    return simulate_loan(data)


@router.post("/affordability", response_model=AffordabilityResult)
async def affordability(data: AffordabilityInput) -> AffordabilityResult:
    return assess_affordability(data)
