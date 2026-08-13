"""Train cash-flow forecasting model."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import mlflow
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression

from ml.config import ARTIFACTS_DIR, MLFLOW_EXPERIMENT_PREFIX, MLFLOW_TRACKING_URI, MODEL_VERSIONS
from ml.data.synthetic.generator import generate_synthetic_dataset
from ml.evaluation.metrics import regression_metrics
from ml.evaluation.validation import chronological_split
from ml.features.cashflow_features import cashflow_features, monthly_cashflow
from ml.preprocessing.cleaning import clean_transactions


def _build_forecast_dataset(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Build lag features for monthly cash-flow forecasting."""
    monthly = monthly_cashflow(df)
    if len(monthly) < 4:
        return np.array([]), np.array([])

    X, y = [], []
    for i in range(3, len(monthly)):
        window = monthly.iloc[i - 3:i]
        feats = cashflow_features(window)
        X.append([
            feats.get("mean_cashflow", 0),
            feats.get("std_cashflow", 0),
            feats.get("mean_income", 0),
            feats.get("mean_expenses", 0),
            feats.get("income_consistency", 0),
            feats.get("trend", 0),
        ])
        y.append(float(monthly.iloc[i]["cashflow"]))

    return np.array(X), np.array(y)


def train_forecaster(data_path: Path | None = None) -> dict:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(f"{MLFLOW_EXPERIMENT_PREFIX}_cashflow_forecaster")

    if data_path is None:
        paths = generate_synthetic_dataset(num_users=50)
        data_path = paths["transactions"]

    df = clean_transactions(pd.read_csv(data_path))
    all_X, all_y = [], []

    for user_id in df["user_id"].unique():
        user_df = df[df["user_id"] == user_id]
        X, y = _build_forecast_dataset(user_df)
        if len(X) > 0:
            all_X.append(X)
            all_y.append(y)

    if not all_X:
        raise ValueError("Insufficient data for forecasting model.")

    X = np.vstack(all_X)
    y = np.concatenate(all_y)

    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    models = {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=50, random_state=42, max_depth=5),
    }

    best_name, best_model, best_metrics = "", None, {"rmse": float("inf")}

    with mlflow.start_run(run_name="cashflow_forecaster"):
        for name, model in models.items():
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            metrics = regression_metrics(y_test, y_pred)
            mlflow.log_metrics({f"{name}_{k}": v for k, v in metrics.items()})
            if metrics["rmse"] < best_metrics["rmse"]:
                best_name, best_model, best_metrics = name, model, metrics

        mlflow.log_params({"best_model": best_name})

        feature_names = [
            "mean_cashflow", "std_cashflow", "mean_income",
            "mean_expenses", "income_consistency", "trend",
        ]
        artifact = {"model": best_model, "feature_names": feature_names, "model_type": best_name}
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        model_path = ARTIFACTS_DIR / "cashflow_forecaster.joblib"
        joblib.dump(artifact, model_path)
        mlflow.log_artifact(str(model_path))

        metadata = {
            "model_name": "cashflow_forecaster",
            "model_version": MODEL_VERSIONS["cashflow_forecaster"],
            "best_model": best_name,
            "metrics": best_metrics,
            "feature_names": feature_names,
        }
        meta_path = ARTIFACTS_DIR / "cashflow_forecaster_meta.json"
        meta_path.write_text(json.dumps(metadata, indent=2, default=str))

    return metadata


if __name__ == "__main__":
    result = train_forecaster()
    print(json.dumps(result, indent=2, default=str))
