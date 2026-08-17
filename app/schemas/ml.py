"""Pydantic schemas for ML API responses."""

from decimal import Decimal

from pydantic import BaseModel, Field


class MLPredictionOut(BaseModel):
    value: str | bool | float | None = None
    confidence: float = 0.0
    confidence_label: str | None = None
    message: str | None = None


class MLModelMeta(BaseModel):
    name: str
    version: str
    feature_version: str | None = None


class MLExplanationFactor(BaseModel):
    factor: str
    impact: str
    description: str
    shap_value: float | None = None


class MLResponse(BaseModel):
    prediction: MLPredictionOut
    explanation: list[MLExplanationFactor] = Field(default_factory=list)
    model: MLModelMeta
    timestamp: str


class CategorizeRequest(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(gt=0)
    transaction_type: str = "expense"


class CategorizeResponse(BaseModel):
    category: str
    confidence: float
    confidence_label: str
    needs_review: bool = False
    model: MLModelMeta
    timestamp: str


class CategoryCorrectionRequest(BaseModel):
    transaction_id: str
    original_prediction: str
    corrected_category: str = Field(min_length=1, max_length=100)


class AnomalyRequest(BaseModel):
    amount: Decimal | None = None


class AnomalyResponse(BaseModel):
    anomaly: bool
    severity: str
    reason: str
    confidence: float
    model: MLModelMeta
    timestamp: str


class ForecastRange(BaseModel):
    predicted: float
    lower: float
    upper: float


class CategoryForecast(BaseModel):
    category: str
    predicted: float
    lower: float
    upper: float
    months_of_data: int


class CashflowForecastResponse(BaseModel):
    status: str = "success"
    method: str = "ml_model"
    forecasts: list[dict]
    expense_forecast: ForecastRange | None = None
    income_forecast: ForecastRange | None = None
    category_forecasts: list[CategoryForecast] = Field(default_factory=list)
    forecast_quality: str = "limited"
    confidence: float
    explanation: list[MLExplanationFactor]
    model: MLModelMeta
    timestamp: str
    available_months: int | None = None
    required_months: int | None = None
    message: str | None = None


class SavingsCapacityResponse(BaseModel):
    lower: float
    upper: float
    currency: str = "INR"
    unit: str = "monthly"
    disclaimer: str
    confidence: float
    explanation: list[MLExplanationFactor]
    model: MLModelMeta
    timestamp: str


class SpendingPatternResponse(BaseModel):
    patterns: list[dict]
    confidence: float
    model: MLModelMeta
    timestamp: str


class RecalculateResponse(BaseModel):
    forecast: dict
    savings: dict
    patterns: dict
    timestamp: str
