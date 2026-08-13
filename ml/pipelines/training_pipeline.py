"""End-to-end training pipeline."""

from __future__ import annotations

import json
from pathlib import Path

from ml.config import ARTIFACTS_DIR
from ml.data.synthetic.generator import generate_synthetic_dataset
from ml.evaluation.fairness import audit_features
from ml.training.train_anomaly import train_anomaly_detector
from ml.training.train_classifier import train_classifier
from ml.training.train_forecast import train_forecaster
from ml.training.train_savings import train_savings_predictor


def run_training_pipeline(num_users: int = 50) -> dict:
    """Execute full training pipeline: data → train → evaluate → register."""
    print("Step 1: Generating synthetic data...")
    paths = generate_synthetic_dataset(num_users=num_users)

    print("Step 2: Fairness pre-check...")
    audit = audit_features(["description", "amount", "type", "day_of_week"])
    if not audit["passed"]:
        raise ValueError(f"Fairness audit failed: {audit}")

    results = {}

    print("Step 3: Training transaction classifier...")
    results["classifier"] = train_classifier(paths["transactions"])

    print("Step 4: Training anomaly detector...")
    results["anomaly"] = train_anomaly_detector(paths["transactions"])

    print("Step 5: Training cash-flow forecaster...")
    results["forecast"] = train_forecaster(paths["transactions"])

    print("Step 6: Training savings predictor...")
    results["savings"] = train_savings_predictor(paths["transactions"], paths["users"])

    summary_path = ARTIFACTS_DIR / "training_summary.json"
    summary_path.write_text(json.dumps(results, indent=2, default=str))
    print(f"\nTraining complete. Summary: {summary_path}")
    return results


if __name__ == "__main__":
    run_training_pipeline()
