"""Recommendations endpoint."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.db.enums import ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.recommendation import RecommendationsResult
from app.services.consent.service import require_consent
from app.services.ml import service as ml_service
from app.services.readiness.factors import build_readiness_input
from app.services.recommendations.engine import generate_recommendations

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationsResult)
async def recommendations(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> RecommendationsResult:
    await require_consent(db, user.id, ConsentType.personalized_recommendations)
    data = await build_readiness_input(db, user.id)

    # Fetch forecast data for budget-aware recommendations
    forecast_data = None
    try:
        forecast_result = await ml_service.get_cashflow_forecast(db, user.id)
        if forecast_result.get("status") == "success":
            forecast_data = forecast_result
    except Exception:
        pass

    return generate_recommendations(data, forecast_data=forecast_data)
