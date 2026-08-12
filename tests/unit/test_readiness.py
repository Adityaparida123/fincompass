"""Unit tests for the credit readiness engine."""

from decimal import Decimal

from app.services.readiness.engine import ReadinessInput, compute_readiness

STRONG = ReadinessInput(
    income=Decimal("50000"),
    total_expenses=Decimal("25000"),
    essential_monthly_expenses=Decimal("20000"),
    debt_payments=Decimal("2000"),
    savings=Decimal("150000"),
    income_months=[Decimal("50000"), Decimal("50000"), Decimal("50000")],
    expense_months=[Decimal("25000"), Decimal("25000"), Decimal("25000")],
)

WEAK = ReadinessInput(
    income=Decimal("25000"),
    total_expenses=Decimal("26000"),
    essential_monthly_expenses=Decimal("20000"),
    debt_payments=Decimal("6000"),
    savings=Decimal("5000"),
    income_months=[Decimal("25000"), Decimal("22000"), Decimal("26000")],
    expense_months=[Decimal("20000"), Decimal("30000"), Decimal("28000")],
)


def test_strong_profile_scores_high():
    result = compute_readiness(STRONG)
    assert result.score >= 70
    assert result.score <= 100


def test_weak_profile_scores_low():
    assert compute_readiness(WEAK).score < compute_readiness(STRONG).score


def test_factors_explainable():
    result = compute_readiness(STRONG)
    names = {f.name for f in result.factors}
    assert {"cash_flow_stability", "savings_capacity", "emergency_buffer"} <= names
    for factor in result.factors:
        assert factor.direction in ("positive", "negative", "neutral")
        assert factor.explanation


def test_no_protected_characteristics_in_factors():
    result = compute_readiness(STRONG)
    joined = " ".join(f.name for f in result.factors).lower()
    for protected in ("race", "religion", "caste", "gender", "sexual", "disability", "political"):
        assert protected not in joined


def test_score_bounded():
    extreme_rich = ReadinessInput(
        income=Decimal("1000000"),
        total_expenses=Decimal("0"),
        essential_monthly_expenses=Decimal("1"),
        debt_payments=Decimal("0"),
        savings=Decimal("10000000"),
    )
    result = compute_readiness(extreme_rich)
    assert 0 <= result.score <= 100


def test_no_income_data_neutral():
    empty = ReadinessInput()
    result = compute_readiness(empty)
    assert 0 <= result.score <= 100


def test_correction_changes_score():
    weak_before = compute_readiness(WEAK)
    corrected = compute_readiness(
        ReadinessInput(
            income=Decimal("45000"),
            total_expenses=Decimal("25000"),
            essential_monthly_expenses=Decimal("20000"),
            debt_payments=Decimal("2000"),
            savings=Decimal("75000"),
        )
    )
    assert corrected.score != weak_before.score
    factors_before = {f.name: f.impact for f in weak_before.factors}
    changed = [f for f in corrected.factors if factors_before.get(f.name) != f.impact]
    assert changed, "At least one factor should change after correction."
