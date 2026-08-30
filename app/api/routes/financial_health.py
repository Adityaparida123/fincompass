"""Financial health endpoint (explainable, non-credit score)."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.db.enums import ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.health import FinancialHealthResult
from app.services.consent.service import require_consent
from app.services.health.service import get_current_health_score

router = APIRouter(prefix="/financial-health", tags=["financial health"])


@router.get("", response_model=FinancialHealthResult)
async def get_financial_health(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> FinancialHealthResult:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    result = await get_current_health_score(db, user.id)
    await db.commit()
    return result