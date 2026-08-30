"""Financial Health Score engine.

A transparent, deterministic composite score of a micro-entrepreneur's
financial resilience as observed from their recorded data. This is NOT a
credit score; it is an internal summary of five financial habits:

    cash_flow        25%  Cash left after every expense and debt payment.
    expense_control  20%  Essential-expense share and spending volatility.
    savings          20%  Savings rate relative to income.
    debt             20%  Monthly debt burden relative to income.
    stability        15%  Consistency of monthly income.

Each pillar is scored 0..100 using linear interpolation between anchors,
then combined with the fixed weights above (which sum to 1.0). Output is a
single 0..100 score, five individually explainable pillar scores, and a
one-line summary. The engine is pure and deterministic: the same observed
data always yields the same score.
"""

from decimal import Decimal
from statistics import mean as _mean
from statistics import pstdev

from app.schemas.health import FinancialHealthFactor, FinancialHealthResult
from app.services.readiness.engine import ReadinessInput

VERSION = "1.0.0"

ZERO = Decimal("0")

# Pillar weights (sum to 1.0).
CASH_FLOW_WEIGHT = 0.25
EXPENSE_CONTROL_WEIGHT = 0.20
SAVINGS_WEIGHT = 0.20
DEBT_WEIGHT = 0.20
STABILITY_WEIGHT = 0.15


def _linear(value: float, lo: float, hi: float) -> float:
    """Map ``value`` linearly onto 0..100 between anchors ``lo`` and ``hi``."""
    if value >= hi:
        return 100.0
    if value <= lo:
        return 0.0
    return (value - lo) / (hi - lo) * 100.0


def _inverse_linear(value: float, excellent: float, poor: float) -> float:
    """Map ``value`` to 100 when at/above ``excellent`` quality and 0 at ``poor``."""
    if value <= excellent:
        return 100.0
    if value >= poor:
        return 0.0
    return (poor - value) / (poor - excellent) * 100.0


def _cv(values: list[Decimal]) -> float | None:
    nums = [float(v) for v in values]
    if len(nums) < 2:
        return None
    mean_v = _mean(nums)
    if mean_v == 0:
        return None
    return pstdev(nums) / abs(mean_v)


def _fmt(value: Decimal, suffix: str = "") -> str:
    return f"{value:,.2f}{suffix}"


def _clamp_int(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _direction(score: int) -> str:
    if score >= 60:
        return "positive"
    if score <= 40:
        return "negative"
    return "neutral"


def _score_cash_flow(data: ReadinessInput) -> FinancialHealthFactor:
    outflow = data.total_expenses + data.debt_payments
    surplus = data.income - outflow
    if data.income <= ZERO:
        score = 0 if outflow > ZERO else 50
        value = "No income recorded"
        explanation = (
            "Cannot confirm positive cash flow without recorded income. "
            "Add your business or salary deposits to see a reliable score."
        )
    else:
        ratio = float(surplus / data.income)
        score = _clamp_int(_linear(ratio, -0.10, 0.20))
        value = f"{_fmt(surplus)} / month after expenses and debt"
        explanation = (
            f"You retain {_fmt(surplus)} per month after expenses and debt "
            "(={ratio:+.0%} of income). "
            + (
                "This healthy margin is the foundation of financial resilience."
                if score >= 60
                else "Increasing the margin by cutting discretionary spending or boosting income would improve this pillar."
            )
        )
    return FinancialHealthFactor(
        name="cash_flow",
        score=score,
        weight=CASH_FLOW_WEIGHT,
        direction=_direction(score),
        explanation=explanation,
        value=value,
    )


def _score_expense_control(data: ReadinessInput) -> FinancialHealthFactor:
    if data.total_expenses <= ZERO:
        return FinancialHealthFactor(
            name="expense_control",
            score=50,
            weight=EXPENSE_CONTROL_WEIGHT,
            direction="neutral",
            explanation="No expense data recorded yet to evaluate spending control.",
            value="No expense data",
        )

    essential_share = float(data.essential_monthly_expenses / data.total_expenses)
    base = _clamp_int(_inverse_linear(essential_share, 0.50, 0.90))

    cv = _cv(data.expense_months)
    penalty = 0.0
    if cv is not None:
        penalty = max(0.0, min(1.0, (cv - 0.10) / 0.40)) * 10.0
    score = _clamp_int(base - penalty)

    parts = [f"Essential needs are {essential_share:.0%} of spending"]
    if cv is not None:
        parts.append(f"monthly spending is fairly consistent (CV {cv:.0%})" if cv < 0.25 else f"monthly spending varies widely (CV {cv:.0%})")
    explanation = (
        ". ".join(parts)
        + ". "
        + (
            "Essential costs stay low and spending is stable — a strong position."
            if score >= 60
            else "Cutting discretionary spending and smoothing irregular purchases would improve this pillar."
        )
    )
    return FinancialHealthFactor(
        name="expense_control",
        score=score,
        weight=EXPENSE_CONTROL_WEIGHT,
        direction=_direction(score),
        explanation=explanation,
        value="_".join(parts),
    )


def _score_savings(data: ReadinessInput) -> FinancialHealthFactor:
    if data.income <= ZERO:
        return FinancialHealthFactor(
            name="savings",
            score=0,
            weight=SAVINGS_WEIGHT,
            direction="negative",
            explanation="No income recorded, so there is currently nothing to save.",
            value=_fmt(data.savings, " saved"),
        )

    surplus = data.income - data.total_expenses - data.debt_payments
    rate = float(surplus / data.income)
    score = _clamp_int(_linear(rate, 0.0, 0.30))
    explanation = (
        f"You currently save {rate:+.0%} of every rupee of income "
        f"(surplus of {_fmt(surplus)} / month). "
        + (
            "This is an excellent habit — keep it up."
            if score >= 60
            else "Automating a fixed transfer right after income arrives is the fastest way to grow this pillar."
        )
    )
    return FinancialHealthFactor(
        name="savings",
        score=score,
        weight=SAVINGS_WEIGHT,
        direction=_direction(score),
        explanation=explanation,
        value=f"{_fmt(data.savings, ' saved')} ({rate:+.0%} rate)",
    )


def _score_debt(data: ReadinessInput) -> FinancialHealthFactor:
    if data.income <= ZERO:
        if data.debt_payments > ZERO:
            return FinancialHealthFactor(
                name="debt",
                score=0,
                weight=DEBT_WEIGHT,
                direction="negative",
                explanation="You carry debt repayments but have no recorded income to cover them.",
                value=_fmt(data.debt_payments, " / month"),
            )
        return FinancialHealthFactor(
            name="debt",
            score=100,
            weight=DEBT_WEIGHT,
            direction="positive",
            explanation="No debt repayments recorded — no debt burden.",
            value="No debt",
        )

    ratio = float(data.debt_payments / data.income)
    score = _clamp_int(_inverse_linear(ratio, 0.10, 0.40))
    explanation = (
        f"Debt repayments are {ratio:.0%} of your income. "
        + (
            "Your debt load is comfortable and well within sustainable limits."
            if score >= 60
            else "Prioritising high-interest debt repayment would meaningfully strengthen your position."
        )
    )
    return FinancialHealthFactor(
        name="debt",
        score=score,
        weight=DEBT_WEIGHT,
        direction=_direction(score),
        explanation=explanation,
        value=f"{_fmt(data.debt_payments, ' / month')} ({ratio:.0%} of income)",
    )


def _score_stability(data: ReadinessInput) -> FinancialHealthFactor:
    active = [v for v in data.income_months if v > ZERO]
    cv = _cv(active)
    if cv is None:
        return FinancialHealthFactor(
            name="stability",
            score=50,
            weight=STABILITY_WEIGHT,
            direction="neutral",
            explanation="Not enough income history yet to judge income stability. Add a few months of transactions to improve confidence.",
            value=f"{len(active)} income month(s) recorded",
        )
    score = _clamp_int(_inverse_linear(cv, 0.10, 0.50))
    explanation = (
        f"Income variation is CV {cv:.0%} across {len(active)} active months. "
        + (
            "Income is steady and predictable, which supports planning and credit readiness."
            if score >= 60
            else "Income swings month to month; diversifying income sources or building a buffer would stabilise this pillar."
        )
    )
    return FinancialHealthFactor(
        name="stability",
        score=score,
        weight=STABILITY_WEIGHT,
        direction=_direction(score),
        explanation=explanation,
        value=f"CV {cv:.0%} over {len(active)} months",
    )


def _summary(score: int) -> str:
    if score >= 75:
        return "Healthy financial habits: strong cash flow, controlled spending and low debt pressure."
    if score >= 50:
        return "A reasonable, improving position — focus on savings, buffers and trimming discretionary spend."
    return "Finances are under pressure — prioritise cash-flow stability, savings and debt relief before expanding."


def compute_health(data: ReadinessInput) -> FinancialHealthResult:
    """Compute the composite Financial Health Score from observed data."""
    factors = [
        _score_cash_flow(data),
        _score_expense_control(data),
        _score_savings(data),
        _score_debt(data),
        _score_stability(data),
    ]

    raw = sum(f.score * f.weight for f in factors)
    score = max(0, min(100, int(round(raw))))

    label = "Good" if score >= 75 else ("Moderate" if score >= 50 else "Needs attention")

    insufficient = (
        data.income <= ZERO
        and data.total_expenses <= ZERO
        and data.debt_payments <= ZERO
        and data.savings <= ZERO
    )

    return FinancialHealthResult(
        score=score,
        label=label,
        version=VERSION,
        factors=factors,
        summary=_summary(score),
        insufficient_data=insufficient,
        is_credit_score=False,
    )
