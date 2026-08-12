"""Credit Readiness Engine.

Deterministic, explainable scoring. No LLM involvement and no protected
characteristics. The algorithm is documented below so that corrections are
traceable and reproducible.

SCORING ALGORITHM
-----------------
Baseline score: 50.

Each factor contributes an integer "impact" (clamped to its range).
Total score = clamp(50 + sum(impacts), 0, 100).

Factors (none use race, religion, caste, gender, sexual orientation,
disability, political affiliation, or any other protected attribute):

1. cash_flow_stability       [-20, +20]
   ratio = (income - expenses - debt) / income
   impact = round(clamp(ratio * 50, -20, 20))

2. income_consistency        [-10, +10]   (0 when no history)
   CV of monthly income; low CV is better.
   cv <= 0.05 -> +10, cv >= 0.40 -> -10, linear between.

3. savings_capacity          [-15, +15]
   rate = (income - expenses - debt) / income
   rate >= 0.30 -> +15, rate <= 0 -> -15, linear between.

4. emergency_buffer          [-15, +15]
   months = savings / essential_monthly_expenses
   months >= 6 -> +15, months <= 0 -> -15, linear between.

5. existing_debt_burden      [-20, 0]
   ratio = debt / income * 100
   ratio >= 40 -> -20, ratio <= 0 -> 0, linear between. Never positive.

6. repayment_affordability   [-10, +10]
   disposable = (income - essential - debt) / income
   disposable >= 0.20 -> +10, disposable <= 0 -> -10, linear between.

7. expense_volatility        [-10, 0]     (0 when no history)
   CV of monthly expenses; high CV is worse.
   cv <= 0.10 -> 0, cv >= 0.50 -> -10, linear between.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from statistics import mean, pstdev

from app.schemas.readiness import ReadinessFactorOut, ReadinessResult

ZERO = Decimal("0")
BASELINE = 50
VERSION = "1.0"


@dataclass
class ReadinessInput:
    income: Decimal = ZERO
    total_expenses: Decimal = ZERO
    essential_monthly_expenses: Decimal = ZERO
    debt_payments: Decimal = ZERO
    savings: Decimal = ZERO
    income_months: list[Decimal] = field(default_factory=list)
    expense_months: list[Decimal] = field(default_factory=list)


def _clamp(value: Decimal, low: Decimal, high: Decimal) -> Decimal:
    return max(low, min(high, value))


def _round_int(value: Decimal) -> int:
    return int(value.to_integral_value(rounding="ROUND_HALF_UP"))


def _cv(values: list[Decimal]) -> Decimal | None:
    if len(values) < 2:
        return None
    avg = mean(values)
    if avg == 0:
        return None
    return Decimal(pstdev(float(v) for v in values)) / Decimal(avg)


def _linear(ratio: Decimal, low_ratio: Decimal, high_ratio: Decimal, low: Decimal, high: Decimal) -> Decimal:
    if ratio <= low_ratio:
        return low
    if ratio >= high_ratio:
        return high
    return low + (high - low) * (ratio - low_ratio) / (high_ratio - low_ratio)


class _FactorRecord:
    def __init__(self, name: str, impact: int, direction: str, explanation: str, value: str | None = None) -> None:
        self.name = name
        self.impact = impact
        self.direction = direction
        self.explanation = explanation
        self.value = value


def _factor(name: str, impact: int, explanation: str, value: str | None = None) -> _FactorRecord:
    direction = "positive" if impact > 0 else "negative" if impact < 0 else "neutral"
    return _FactorRecord(name=name, impact=impact, direction=direction, explanation=explanation, value=value)


def compute_readiness(data: ReadinessInput) -> ReadinessResult:
    income = data.income
    factors: list[_FactorRecord] = []

    if income > 0:
        total_outflow = data.total_expenses + data.debt_payments
        cash_ratio = (income - total_outflow) / income
        cash_impact = _round_int(_clamp(cash_ratio * Decimal("50"), Decimal("-20"), Decimal("20")))
        factors.append(
            _factor(
                "cash_flow_stability",
                cash_impact,
                (
                    "Cash flow has remained positive."
                    if cash_impact >= 0
                    else "Cash flow after expenses and debt payments is negative."
                ),
                value=f"available {(income - total_outflow):,.2f}",
            )
        )

        savings_rate = (income - total_outflow) / income
        savings_impact = _round_int(
            _linear(savings_rate, ZERO, Decimal("0.30"), Decimal("-15"), Decimal("15"))
        )
        factors.append(
            _factor(
                "savings_capacity",
                savings_impact,
                (
                    "Healthy savings capacity based on income and spending."
                    if savings_impact > 0
                    else "Savings capacity is currently low."
                ),
                value=f"rate {savings_rate * 100:.1f}%",
            )
        )
    else:
        factors.append(
            _factor("cash_flow_stability", -10, "No income data available to assess cash flow.")
        )
        factors.append(_factor("savings_capacity", -5, "No income data available to assess savings."))

    cv_income = _cv(data.income_months)
    if cv_income is None:
        factors.append(
            _factor("income_consistency", 0, "Insufficient income history for consistency analysis.")
        )
    else:
        impact = _round_int(_linear(cv_income, Decimal("0.05"), Decimal("0.40"), Decimal("10"), Decimal("-10")))
        factors.append(
            _factor(
                "income_consistency",
                impact,
                (
                    "Income has been consistent across recent months."
                    if impact > 0
                    else "Income has varied noticeably across recent months."
                ),
                value=f"cv {cv_income:.2f}",
            )
        )

    if data.essential_monthly_expenses > 0:
        months = data.savings / data.essential_monthly_expenses
        em_impact = _round_int(_linear(months, ZERO, Decimal("6"), Decimal("-15"), Decimal("15")))
        factors.append(
            _factor(
                "emergency_buffer",
                em_impact,
                (
                    "Emergency fund covers at least 6 months of essential expenses."
                    if em_impact > 0
                    else "Emergency fund is limited relative to essential expenses."
                ),
                value=f"{months:.2f} months",
            )
        )
    else:
        factors.append(_factor("emergency_buffer", 0, "No essential expense data to assess emergency buffer."))

    if income > 0:
        debt_ratio = (data.debt_payments / income) * Decimal("100")
        debt_impact = _round_int(_linear(debt_ratio, ZERO, Decimal("40"), ZERO, Decimal("-20")))
        factors.append(
            _factor(
                "existing_debt_burden",
                debt_impact,
                (
                    "Existing debt is minimal relative to income."
                    if debt_impact >= 0
                    else "Existing debt reduces available monthly cash flow."
                ),
                value=f"debt/income {debt_ratio:.1f}%",
            )
        )

        disposable = (income - data.essential_monthly_expenses - data.debt_payments) / income
        afford_impact = _round_int(
            _linear(disposable, ZERO, Decimal("0.20"), Decimal("-10"), Decimal("10"))
        )
        factors.append(
            _factor(
                "repayment_affordability",
                afford_impact,
                (
                    "Repayment capacity after essential spending appears adequate."
                    if afford_impact > 0
                    else "Little room remains for additional repayments after essentials."
                ),
                value=f"disposable {disposable * 100:.1f}%",
            )
        )
    else:
        factors.append(
            _factor("existing_debt_burden", 0, "No income data available to assess debt burden.")
        )
        factors.append(
            _factor("repayment_affordability", 0, "No income data available to assess repayment capacity.")
        )

    cv_exp = _cv(data.expense_months)
    if cv_exp is None:
        factors.append(
            _factor("expense_volatility", 0, "Insufficient expense history for volatility analysis.")
        )
    else:
        impact = _round_int(_linear(cv_exp, Decimal("0.10"), Decimal("0.50"), ZERO, Decimal("-10")))
        factors.append(
            _factor(
                "expense_volatility",
                impact,
                "Expense levels have been stable across months."
                if impact >= 0
                else "Expense levels have fluctuated, which increases financial uncertainty.",
                value=f"cv {cv_exp:.2f}",
            )
        )

    score = BASELINE + sum(f.impact for f in factors)
    score = max(0, min(100, score))

    summary = _summary(score)

    return ReadinessResult(
        score=score,
        version=VERSION,
        factors=[_to_out(f) for f in factors],
        summary=summary,
    )


def _to_out(f: _FactorRecord) -> ReadinessFactorOut:
    return ReadinessFactorOut(
        name=f.name, impact=f.impact, direction=f.direction, explanation=f.explanation, value=f.value
    )


def _summary(score: int) -> str:
    if score >= 75:
        return "Strong financial foundation with healthy buffers and low debt pressure."
    if score >= 50:
        return "Reasonable financial position; strengthening savings and buffers would help."
    return "Financial position is tight; focus on budgeting, savings, and reducing debt pressure before considering credit."
