"""Train savings capacity prediction model."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import mlflow
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

from ml.config import ARTIFACTS_DIR, MLFLOW_EXPERIMENT_PREFIX, MLFLOW_TRACKING_URI, MODEL_VERSIONS
from ml.data.synthetic.generator import generate_synthetic_dataset
from ml.evaluation.metrics import regression_metrics
from ml.features.cashflow_features import monthly_cashflow
from ml.features.savings_features import savings_features
from ml.preprocessing.cleaning import clean_transactions


def _build_savings_dataset(
    transactions: pd.DataFrame,
    users: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    for _, user in users.iterrows():
        user_id = user["user_id"]
        user_tx = transactions[transactions["user_id"] == user_id]
        monthly = monthly_cashflow(user_tx)
        if len(monthly) < 2:
            continue

        debt = float(user.get("debt_obligations", 0))
        savings_bal = float(user.get("savings_balance", 0))
        feats = savings_features(monthly, debt_payment=debt, current_savings=savings_bal)

        X.append([
            feats.get("avg_income", 0),
            feats.get("avg_expenses", 0),
            feats.get("discretionary_expenses", 0),
            feats.get("debt_obligations", 0),
            feats.get("expense_volatility", 0),
            feats.get("historical_net_savings", 0),
        ])
        y.append(feats.get("net_after_debt", 0))

    return np.array(X), np.array(y)


def train_savings_predictor(
    tx_path: Path | None = None,
    users_path: Path | None = None,
) -> dict:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(f"{MLFLOW_EXPERIMENT_PREFIX}_savings_predictor")

    if tx_path is None:
        paths = generate_synthetic_dataset(num_users=50)
        tx_path = paths["transactions"]
        users_path = paths["users"]

    df = clean_transactions(pd.read_csv(tx_path))
    users = pd.read_csv(users_path)

    X, y = _build_savings_dataset(df, users)
    if len(X) < 5:
        raise ValueError("Insufficient data for savings model.")

    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    model = GradientBoostingRegressor(
        n_estimators=50, max_depth=3, random_state=42, learning_rate=0.1
    )

    with mlflow.start_run(run_name="savings_predictor"):
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        metrics = regression_metrics(y_test, y_pred)

        mlflow.log_metrics(metrics)
        mlflow.log_params({"algorithm": "gradient_boosting", "train_size": len(X_train)})

        feature_names = [
            "avg_income", "avg_expenses", "discretionary_expenses",
            "debt_obligations", "expense_volatility", "historical_net_savings",
        ]
        artifact = {"model": model, "feature_names": feature_names}
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        model_path = ARTIFACTS_DIR / "savings_predictor.joblib"
        joblib.dump(artifact, model_path)
        mlflow.log_artifact(str(model_path))

        metadata = {
            "model_name": "savings_predictor",
            "model_version": MODEL_VERSIONS["savings_predictor"],
            "metrics": metrics,
            "feature_names": feature_names,
        }
        meta_path = ARTIFACTS_DIR / "savings_predictor_meta.json"
        meta_path.write_text(json.dumps(metadata, indent=2, default=str))

    return metadata


if __name__ == "__main__":
    result = train_savings_predictor()
    print(json.dumps(result, indent=2, default=str))
