"""Credit readiness endpoints (explainable, correctable score)."""

from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.db.enums import ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.readiness import ReadinessResult, ScoreCorrectionResult
from app.services.consent.service import require_consent
from app.services.readiness.engine import ReadinessInput
from app.services.readiness.service import correct_score, get_current_readiness

router = APIRouter(prefix="/credit-readiness", tags=["credit readiness"])


class CorrectionInput(BaseModel):
    income: Decimal = Field(gt=0)
    total_expenses: Decimal = Field(ge=0)
    essential_monthly_expenses: Decimal = Field(ge=0)
    debt_payments: Decimal = Field(ge=0)
    savings: Decimal = Field(ge=0)
    reason: str = Field(min_length=1, max_length=500)


@router.get("", response_model=ReadinessResult)
async def get_readiness(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> ReadinessResult:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    result = await get_current_readiness(db, user.id)
    await db.commit()
    return result


@router.post("/correct", response_model=ScoreCorrectionResult)
async def correct(
    data: CorrectionInput,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> ScoreCorrectionResult:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    updated = ReadinessInput(
        income=data.income,
        total_expenses=data.total_expenses,
        essential_monthly_expenses=data.essential_monthly_expenses,
        debt_payments=data.debt_payments,
        savings=data.savings,
    )
    result = await correct_score(db, user.id, updated, data.reason)
    await db.commit()
    return result
