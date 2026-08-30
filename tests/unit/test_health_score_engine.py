"""Unit tests for the financial health score engine."""

from decimal import Decimal

from app.services.health.engine import compute_health
from app.services.readiness.engine import ReadinessInput

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

MEDIUM = ReadinessInput(
    income=Decimal("40000"),
    total_expenses=Decimal("30000"),
    essential_monthly_expenses=Decimal("22000"),
    debt_payments=Decimal("3000"),
    savings=Decimal("50000"),
    income_months=[Decimal("40000"), Decimal("38000"), Decimal("42000")],
    expense_months=[Decimal("30000"), Decimal("32000"), Decimal("28000")],
)

NO_DATA = ReadinessInput()


def test_weights_sum_to_one():
    result = compute_health(STRONG)
    total = sum(f.weight for f in result.factors)
    assert abs(total - 1.0) < 1e-9


def test_five_pillars_with_explanations():
    result = compute_health(STRONG)
    assert len(result.factors) == 5
    for factor in result.factors:
        assert factor.explanation, f"{factor.name} missing explanation"
        assert 0 <= factor.score <= 100
        assert factor.direction in ("positive", "negative", "neutral")


def test_score_bounded_0_100():
    assert 0 <= compute_health(WEAK).score <= 100


def test_monotonic_order():
    weak_score = compute_health(WEAK).score
    medium_score = compute_health(MEDIUM).score
    strong_score = compute_health(STRONG).score
    assert weak_score <= medium_score <= strong_score


def test_strong_profile_scores_good():
    result = compute_health(STRONG)
    assert result.label == "Good"
    assert result.score >= 75


def test_no_data_flagged_insufficient():
    result = compute_health(NO_DATA)
    assert result.insufficient_data is True
    assert result.score >= 0


def test_deterministic():
    assert compute_health(MEDIUM).score == compute_health(MEDIUM).score


def test_never_a_credit_score():
    assert compute_health(STRONG).is_credit_score is False


def test_every_factor_reports_value_or_reason():
    result = compute_health(WEAK)
    for factor in result.factors:
        assert factor.value, f"{factor.name} missing value"
