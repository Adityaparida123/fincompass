"""Sklearn-compatible preprocessing pipelines."""

from __future__ import annotations

from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def build_classifier_pipeline(model) -> Pipeline:
    """TF-IDF on description + numeric features → classifier."""
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words="english",
            sublinear_tf=True,
        )),
        ("classifier", model),
    ])


def build_numeric_pipeline(model, feature_names: list[str] | None = None) -> Pipeline:
    """StandardScaler → model for numeric-only tasks."""
    steps = [("scaler", StandardScaler())]
    if model is not None:
        steps.append(("model", model))
    return Pipeline(steps)


def prepare_classifier_text(df) -> list[str]:
    """Combine description with category hints for TF-IDF."""
    texts = []
    for _, row in df.iterrows():
        desc = str(row.get("description", ""))
        tx_type = str(row.get("type", ""))
        texts.append(f"{desc} {tx_type}")
    return texts
