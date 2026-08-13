"""Train spending anomaly detection model."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import mlflow
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from ml.config import ARTIFACTS_DIR, MLFLOW_EXPERIMENT_PREFIX, MLFLOW_TRACKING_URI, MODEL_VERSIONS
from ml.data.synthetic.generator import generate_synthetic_dataset
from ml.evaluation.fairness import audit_features
from ml.features.transaction_features import compute_rolling_features
from ml.preprocessing.cleaning import clean_transactions


def _build_anomaly_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build feature matrix for anomaly detection."""
    records = []
    for user_id in df["user_id"].unique():
        user_df = compute_rolling_features(df, user_id)
        for _, row in user_df.iterrows():
            if pd.isna(row.get("rolling_mean")):
                continue
            records.append({
                "amount": float(row["amount"]),
                "rolling_mean": float(row["rolling_mean"]),
                "rolling_std": float(row["rolling_std"]) if not pd.isna(row["rolling_std"]) else 0,
                "amount_deviation": float(row["amount_deviation"]) if not pd.isna(row["amount_deviation"]) else 0,
                "day_of_week": int(row.get("day_of_week", 0)),
            })
    return pd.DataFrame(records)


def train_anomaly_detector(data_path: Path | None = None) -> dict:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(f"{MLFLOW_EXPERIMENT_PREFIX}_anomaly_detector")

    if data_path is None:
        paths = generate_synthetic_dataset(num_users=50)
        data_path = paths["transactions"]

    df = clean_transactions(pd.read_csv(data_path))
    df["date"] = pd.to_datetime(df["date"])
    features = _build_anomaly_features(df)

    feature_cols = list(features.columns)
    audit = audit_features(feature_cols)
    if not audit["passed"]:
        raise ValueError(f"Fairness audit failed: {audit}")

    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42,
    )

    with mlflow.start_run(run_name="isolation_forest"):
        model.fit(features[feature_cols])
        predictions = model.predict(features[feature_cols])
        anomaly_rate = float((predictions == -1).sum() / len(predictions))

        mlflow.log_params({"algorithm": "isolation_forest", "contamination": 0.05})
        mlflow.log_metrics({"anomaly_rate": anomaly_rate, "samples": len(features)})

        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        artifact = {
            "model": model,
            "feature_columns": feature_cols,
        }
        model_path = ARTIFACTS_DIR / "anomaly_detector.joblib"
        joblib.dump(artifact, model_path)
        mlflow.log_artifact(str(model_path))

        metadata = {
            "model_name": "anomaly_detector",
            "model_version": MODEL_VERSIONS["anomaly_detector"],
            "anomaly_rate": anomaly_rate,
            "feature_columns": feature_cols,
        }
        meta_path = ARTIFACTS_DIR / "anomaly_detector_meta.json"
        meta_path.write_text(json.dumps(metadata, indent=2))

    return metadata


if __name__ == "__main__":
    result = train_anomaly_detector()
    print(json.dumps(result, indent=2))
