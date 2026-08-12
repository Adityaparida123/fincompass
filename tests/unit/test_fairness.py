"""Fairness tests for credit readiness — protected characteristics must not affect scores."""

from decimal import Decimal

from app.services.readiness.engine import ReadinessInput, compute_readiness


def _base_input() -> ReadinessInput:
    return ReadinessInput(
        income=Decimal("50000"),
        total_expenses=Decimal("28000"),
        essential_monthly_expenses=Decimal("20000"),
        debt_payments=Decimal("5000"),
        savings=Decimal("120000"),
        income_months=[Decimal("48000"), Decimal("50000"), Decimal("51000")],
        expense_months=[Decimal("27000"), Decimal("28000"), Decimal("29000")],
    )


def test_identical_financial_profiles_produce_identical_scores():
    a = compute_readiness(_base_input())
    b = compute_readiness(_base_input())
    assert a.score == b.score
    assert [f.name for f in a.factors] == [f.name for f in b.factors]
    assert [f.impact for f in a.factors] == [f.impact for f in b.factors]


def test_readiness_input_has_no_protected_characteristic_fields():
    fields = set(ReadinessInput.__dataclass_fields__.keys())
    forbidden = {
        "race",
        "religion",
        "caste",
        "gender",
        "sexual_orientation",
        "political_affiliation",
        "disability",
    }
    assert forbidden.isdisjoint(fields)


def test_score_is_deterministic_across_repeated_calls():
    results = [compute_readiness(_base_input()).score for _ in range(5)]
    assert len(set(results)) == 1


def test_changing_income_changes_score_with_auditable_factors():
    low = _base_input()
    high = _base_input()
    high.income = Decimal("70000")
    low_score = compute_readiness(low)
    high_score = compute_readiness(high)
    assert high_score.score >= low_score.score
    assert any(f.impact != 0 for f in high_score.factors)
