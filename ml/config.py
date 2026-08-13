"""ML configuration, constants, and model versioning."""

from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent
DATA_DIR = ML_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
MODELS_DIR = ML_ROOT / "models"
ARTIFACTS_DIR = MODELS_DIR / "artifacts"

TRANSACTION_CATEGORIES = [
    "food",
    "groceries",
    "transport",
    "housing",
    "utilities",
    "healthcare",
    "education",
    "shopping",
    "entertainment",
    "subscriptions",
    "debt_payment",
    "savings",
    "income",
    "other",
]

PROTECTED_CHARACTERISTICS = frozenset({
    "religion",
    "caste",
    "race",
    "ethnicity",
    "gender",
    "sexual_orientation",
    "political_affiliation",
    "disability",
})

# Minimum historical data requirements
MIN_TRANSACTIONS_FOR_ANOMALY = 10
MIN_MONTHS_FOR_FORECAST = 3
MIN_MONTHS_FOR_SAVINGS = 2
MIN_MONTHS_FOR_PATTERNS = 2

# Confidence thresholds
CLASSIFIER_CONFIDENCE_THRESHOLD = 0.55
LOW_CONFIDENCE_THRESHOLD = 0.40

# Model versions (bump on retrain)
MODEL_VERSIONS = {
    "transaction_classifier": "1.0.0",
    "anomaly_detector": "1.0.0",
    "cashflow_forecaster": "1.0.0",
    "savings_predictor": "1.0.0",
    "spending_patterns": "1.0.0",
}

FEATURE_VERSION = "1.0"

# MLflow — sqlite backend for experiment tracking
MLFLOW_TRACKING_URI = f"sqlite:///{(ML_ROOT / 'mlflow.db').as_posix()}"
MLFLOW_EXPERIMENT_PREFIX = "fincompass"
