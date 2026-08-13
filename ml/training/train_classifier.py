"""Train transaction categorization model."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import mlflow
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.svm import LinearSVC

from ml.config import (
    ARTIFACTS_DIR,
    MLFLOW_EXPERIMENT_PREFIX,
    MLFLOW_TRACKING_URI,
    MODEL_VERSIONS,
    SYNTHETIC_DIR,
    TRANSACTION_CATEGORIES,
)
from ml.data.synthetic.generator import generate_synthetic_dataset
from ml.evaluation.fairness import audit_features
from ml.evaluation.metrics import classification_metrics
from ml.preprocessing.cleaning import clean_transactions
from ml.preprocessing.pipelines import build_classifier_pipeline, prepare_classifier_text


def train_classifier(
    data_path: Path | None = None,
    model_type: str = "logistic_regression",
) -> dict:
    """Train and register transaction classifier."""
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(f"{MLFLOW_EXPERIMENT_PREFIX}_expense_classifier")

    if data_path is None:
        paths = generate_synthetic_dataset(num_users=50)
        data_path = paths["transactions"]

    df = clean_transactions(pd.read_csv(data_path))
    texts = prepare_classifier_text(df)
    y = df["category"].values

    audit = audit_features(["description", "amount", "type", "day_of_week"])
    if not audit["passed"]:
        raise ValueError(f"Fairness audit failed: {audit}")

    X_train, X_test, y_train, y_test = train_test_split(
        texts, y, test_size=0.2, stratify=y, random_state=42
    )

    if model_type == "linear_svm":
        base_model = LinearSVC(max_iter=2000, class_weight="balanced")
    else:
        base_model = LogisticRegression(
            max_iter=1000, class_weight="balanced", C=1.0
        )

    pipeline = build_classifier_pipeline(base_model)

    with mlflow.start_run(run_name=f"classifier_{model_type}"):
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)

        try:
            y_proba = pipeline.predict_proba(X_test)
            confidences = y_proba.max(axis=1).mean()
        except AttributeError:
            confidences = 0.7

        metrics = classification_metrics(y_test, y_pred, labels=TRANSACTION_CATEGORIES)
        mlflow.log_params({"model_type": model_type, "train_size": len(X_train)})
        mlflow.log_metrics({
            "accuracy": metrics["accuracy"],
            "f1": metrics["f1"],
            "precision": metrics["precision"],
            "recall": metrics["recall"],
            "avg_confidence": float(confidences),
        })

        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        model_path = ARTIFACTS_DIR / "transaction_classifier.joblib"
        joblib.dump(pipeline, model_path)
        mlflow.log_artifact(str(model_path))

        metadata = {
            "model_name": "transaction_classifier",
            "model_version": MODEL_VERSIONS["transaction_classifier"],
            "model_type": model_type,
            "metrics": metrics,
            "categories": TRANSACTION_CATEGORIES,
        }
        meta_path = ARTIFACTS_DIR / "transaction_classifier_meta.json"
        meta_path.write_text(json.dumps(metadata, indent=2, default=str))

    return metadata


if __name__ == "__main__":
    result = train_classifier()
    print(json.dumps(result["metrics"], indent=2))
