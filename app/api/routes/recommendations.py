"""Recommendations endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.models.consent import ConsentType
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.recommendation import RecommendationsResult
from app.services.consent.service import require_consent
from app.services.readiness.factors import build_readiness_input
from app.services.recommendations.engine import generate_recommendations

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationsResult)
async def recommendations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> RecommendationsResult:
    await require_consent(db, user.id, ConsentType.personalized_recommendations)
    data = await build_readiness_input(db, user.id)
    return generate_recommendations(data)
