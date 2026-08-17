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


def test_strong_profile_scores_high():
    result = compute_readiness(STRONG)
    assert result.score >= 70
    assert result.score <= 100


def test_weak_profile_scores_low():
    assert compute_readiness(WEAK).score < compute_readiness(STRONG).score


def test_medium_profile_scores_between():
    weak_score = compute_readiness(WEAK).score
    strong_score = compute_readiness(STRONG).score
    medium_score = compute_readiness(MEDIUM).score
    assert weak_score <= medium_score <= strong_score


def test_no_data_scores_near_35():
    """When no financial data exists, score should be baseline(50) - 15(no-income penalties) = 35."""
    result = compute_readiness(NO_DATA)
    assert result.score == 35


def test_no_data_has_all_seven_factors():
    result = compute_readiness(NO_DATA)
    assert len(result.factors) == 7
    names = {f.name for f in result.factors}
    expected = {
        "cash_flow_stability",
        "savings_capacity",
        "income_consistency",
        "emergency_buffer",
        "existing_debt_burden",
        "repayment_affordability",
        "expense_volatility",
    }
    assert names == expected


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


def test_strong_profile_all_positive_factors():
    result = compute_readiness(STRONG)
    named = {f.name: f for f in result.factors}
    assert named["cash_flow_stability"].impact > 0
    assert named["savings_capacity"].impact > 0
    assert named["emergency_buffer"].impact > 0
    assert named["income_consistency"].impact > 0


def test_weak_profile_negative_debt_burden():
    result = compute_readiness(WEAK)
    named = {f.name: f for f in result.factors}
    assert named["existing_debt_burden"].impact < 0
    assert named["savings_capacity"].impact <= 0


def test_zero_income_gives_negative_impacts():
    """Zero income should produce negative impacts for income-dependent factors."""
    result = compute_readiness(NO_DATA)
    named = {f.name: f for f in result.factors}
    assert named["cash_flow_stability"].impact < 0
    assert named["savings_capacity"].impact < 0
    assert named["income_consistency"].direction == "neutral"
    assert named["expense_volatility"].direction == "neutral"


def test_high_debt_reduces_score():
    high_debt = ReadinessInput(
        income=Decimal("30000"),
        total_expenses=Decimal("15000"),
        essential_monthly_expenses=Decimal("12000"),
        debt_payments=Decimal("12000"),
        savings=Decimal("10000"),
    )
    low_debt = ReadinessInput(
        income=Decimal("30000"),
        total_expenses=Decimal("15000"),
        essential_monthly_expenses=Decimal("12000"),
        debt_payments=Decimal("1000"),
        savings=Decimal("10000"),
    )
    assert compute_readiness(high_debt).score < compute_readiness(low_debt).score


def test_high_savings_boosts_score():
    high_savings = ReadinessInput(
        income=Decimal("50000"),
        total_expenses=Decimal("20000"),
        essential_monthly_expenses=Decimal("15000"),
        debt_payments=Decimal("2000"),
        savings=Decimal("300000"),
    )
    low_savings = ReadinessInput(
        income=Decimal("50000"),
        total_expenses=Decimal("20000"),
        essential_monthly_expenses=Decimal("15000"),
        debt_payments=Decimal("2000"),
        savings=Decimal("5000"),
    )
    assert compute_readiness(high_savings).score > compute_readiness(low_savings).score


def test_version_is_set():
    result = compute_readiness(STRONG)
    assert result.version == "1.0"


def test_summary_matches_score():
    result = compute_readiness(STRONG)
    if result.score >= 75:
        assert "Strong" in result.summary
    elif result.score >= 50:
        assert "Reasonable" in result.summary
    else:
        assert "tight" in result.summary


def test_factor_direction_matches_impact():
    """Direction should be positive/negative/neutral based on impact sign."""
    for profile in (STRONG, WEAK, MEDIUM, NO_DATA):
        result = compute_readiness(profile)
        for f in result.factors:
            if f.impact > 0:
                assert f.direction == "positive", f"{f.name}: impact={f.impact} but direction={f.direction}"
            elif f.impact < 0:
                assert f.direction == "negative", f"{f.name}: impact={f.impact} but direction={f.direction}"
            else:
                assert f.direction == "neutral", f"{f.name}: impact={f.impact} but direction={f.direction}"
