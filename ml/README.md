# FinCompass Machine Learning Layer

Responsible, explainable ML for financial wellness. This layer handles probabilistic predictions and pattern detection — **not** loan approval decisions or authoritative financial calculations.

## Architecture

```
Layer 1 — Deterministic Financial Engine (app/services/finance/)
Layer 2 — Machine Learning (ml/)                          ← this layer
Layer 3 — FinAI / LLM (app/ai/)
```

## Models

| Model | Algorithm | Purpose |
|-------|-----------|---------|
| Transaction Classifier | TF-IDF + Logistic Regression | Auto-categorize transactions |
| Anomaly Detector | Isolation Forest | Detect unusual spending patterns |
| Cash-flow Forecaster | Linear Regression / Random Forest | Forecast monthly cash flow |
| Savings Predictor | Gradient Boosting Regressor | Estimate savings capacity range |
| Spending Patterns | Rule-based + rolling stats | Detect behavioral trends |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Generate synthetic data and train all models
python -m ml.pipelines.training_pipeline

# Run demo scenario
python -m ml.demo.run_demo

# Run tests
pytest ml/tests/ -v
```

## API Endpoints

All endpoints require authentication and `financial_data_analysis` consent.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ml/categorize` | Categorize a transaction |
| POST | `/api/v1/ml/categorize/correct` | User category correction (persisted) |
| POST | `/api/v1/ml/anomaly` | Detect spending anomaly |
| GET | `/api/v1/ml/spending-patterns` | Detect spending patterns |
| GET | `/api/v1/ml/cashflow-forecast` | Forecast cash flow |
| GET | `/api/v1/ml/savings-capacity` | Estimate savings capacity |
| POST | `/api/v1/ml/recalculate` | Recalculate after correction |
| GET | `/api/v1/ml/explanations` | Combined ML explanations |

Predictions are persisted to the `ml_predictions` table. Category corrections update
the authoritative transaction record when a numeric transaction ID is provided.

FinAI can call ML tools: `get_spending_patterns`, `get_cashflow_forecast`, `get_ml_savings_capacity`.
| POST | `/api/v1/ml/recalculate` | Recalculate after data correction |
| GET | `/api/v1/ml/explanations` | Combined ML explanations |

## Principles

- **No protected characteristics** as model features
- **No loan approval decisions** — readiness uses transparent rule-based scoring
- **Explainable** — SHAP + human-readable factor descriptions
- **Correctable** — user corrections invalidate cache and trigger recalculation
- **Privacy-first** — consent required, minimum data retrieval
- **Uncertainty** — confidence scores and ranges, never fabricated predictions

## Project Structure

```
ml/
├── data/synthetic/       # Synthetic dataset generator
├── preprocessing/        # Cleaning, validation, pipelines
├── features/             # Feature engineering
├── models/artifacts/     # Trained model files (joblib)
├── training/             # Training scripts
├── evaluation/           # Metrics, fairness, validation
├── explainability/       # SHAP explainers
├── inference/            # Inference wrappers
├── pipelines/            # Training + inference orchestration
├── tests/                # Pytest suite
└── demo/                 # Hackathon demo scenario
```

## Model Versioning

Every prediction includes:
- `model_name`, `model_version`, `feature_version`, `timestamp`

Training experiments tracked via MLflow in `ml/mlruns/`.
