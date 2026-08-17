"""ML API endpoints — categorization, anomaly, forecasting, savings, patterns."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user, rate_limit_ml
from app.db.enums import ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.ml import (
    AnomalyRequest,
    AnomalyResponse,
    CashflowForecastResponse,
    CategorizeRequest,
    CategorizeResponse,
    CategoryCorrectionRequest,
    MLExplanationFactor,
    MLModelMeta,
    RecalculateResponse,
    SavingsCapacityResponse,
    SpendingPatternResponse,
)
from app.services.consent.service import require_consent
from app.services.ml import service as ml_service

router = APIRouter(
    prefix="/ml",
    tags=["Machine Learning"],
    dependencies=[Depends(rate_limit_ml)],
)


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_transaction(
    body: CategorizeRequest,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> CategorizeResponse:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    result = await ml_service.categorize_transaction(
        body.description, body.amount, body.transaction_type
    )
    pred = result["prediction"]
    model = result["model"]
    return CategorizeResponse(
        category=pred["value"],
        confidence=pred["confidence"],
        confidence_label=pred.get("confidence_label", "medium"),
        needs_review=pred.get("needs_review", False),
        model=MLModelMeta(**model),
        timestamp=result["timestamp"],
    )


@router.post("/categorize/correct")
async def correct_categorization(
    body: CategoryCorrectionRequest,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    return await ml_service.correct_category(
        db,
        user.id,
        body.transaction_id,
        body.original_prediction,
        body.corrected_category,
    )


@router.post("/anomaly", response_model=AnomalyResponse)
async def detect_anomaly(
    body: AnomalyRequest | None = None,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> AnomalyResponse:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    amount = body.amount if body else None
    result = await ml_service.detect_anomaly(db, user.id, amount)
    return AnomalyResponse(
        anomaly=result.get("anomaly", False),
        severity=result.get("severity", "none"),
        reason=result.get("reason", ""),
        confidence=result["prediction"]["confidence"],
        model=MLModelMeta(**result["model"]),
        timestamp=result["timestamp"],
    )


@router.get("/spending-patterns", response_model=SpendingPatternResponse)
async def spending_patterns(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> SpendingPatternResponse:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    result = await ml_service.get_spending_patterns(db, user.id)
    return SpendingPatternResponse(
        patterns=result.get("patterns", []),
        confidence=result["prediction"]["confidence"],
        model=MLModelMeta(**result["model"]),
        timestamp=result["timestamp"],
    )


@router.get("/cashflow-forecast", response_model=CashflowForecastResponse)
async def cashflow_forecast(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> CashflowForecastResponse:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    result = await ml_service.get_cashflow_forecast(db, user.id)
    return CashflowForecastResponse(
        status=result.get("status", "success"),
        method=result.get("method", "ml_model"),
        forecasts=result.get("forecasts", []),
        confidence=result["prediction"]["confidence"],
        explanation=[MLExplanationFactor(**e) for e in result.get("explanation", [])],
        model=MLModelMeta(**result["model"]),
        timestamp=result["timestamp"],
        available_months=result.get("available_months"),
        required_months=result.get("required_months"),
        message=result.get("message"),
    )


@router.get("/savings-capacity", response_model=SavingsCapacityResponse)
async def savings_capacity(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> SavingsCapacityResponse:
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    result = await ml_service.get_savings_capacity(db, user.id)
    cap = result.get("savings_capacity", {})
    return SavingsCapacityResponse(
        lower=cap.get("lower", 0),
        upper=cap.get("upper", 0),
        currency=cap.get("currency", "INR"),
        unit=cap.get("unit", "monthly"),
        disclaimer=cap.get("disclaimer", ""),
        confidence=result["prediction"]["confidence"],
        explanation=[MLExplanationFactor(**e) for e in result.get("explanation", [])],
        model=MLModelMeta(**result["model"]),
        timestamp=result["timestamp"],
    )


@router.post("/recalculate", response_model=RecalculateResponse)
async def recalculate_predictions(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> RecalculateResponse:
    """Recalculate all ML predictions after user data correction."""
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    result = await ml_service.recalculate_all(db, user.id)
    return RecalculateResponse(
        forecast=result["forecast"],
        savings=result["savings"],
        patterns=result["patterns"],
        timestamp=result["timestamp"],
    )


@router.get("/explanations")
async def get_explanations(
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> dict:
    """Combined ML explanations for the user's financial profile."""
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    patterns = await ml_service.get_spending_patterns(db, user.id)
    forecast = await ml_service.get_cashflow_forecast(db, user.id)
    savings = await ml_service.get_savings_capacity(db, user.id)
    return {
        "spending_patterns": patterns.get("patterns", []),
        "cashflow_forecast": forecast.get("forecasts", []),
        "savings_capacity": savings.get("savings_capacity", {}),
        "explanations": {
            "patterns": patterns.get("patterns", []),
            "forecast": forecast.get("explanation", []),
            "savings": savings.get("explanation", []),
        },
        "timestamp": forecast.get("timestamp"),
    }
