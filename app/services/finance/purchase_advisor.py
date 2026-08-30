"""Purchase affordability advisory.

Answers "can I afford this?" deterministically against the user's actual
averaged financial position, without writing anything to the database.

Three scenarios are always modelled from the same baseline:

    buy_now    paying the full amount from the user's savings balance today.
    save_first setting aside the amount over future months from the monthly
               surplus (with an optional side-benefit that buying now would
               create, so the opportunity-cost trade-off is visible).
    finance    paying an EMI over a tenure (interest optional), with the
               resulting debt burden applied to future cash flow.

Every verdict is derived from real averaged numbers and labelled honestly.
"""

from dataclasses import dataclass
from decimal import Decimal

from app.schemas.advisor import (
    BaselineSnapshot,
    PurchaseAffordabilityResult,
    PurchaseScenarioOut,
)
from app.services.health.engine import compute_health
from app.services.lending.emi import emi_result
from app.services.readiness.engine import ReadinessInput
from app.services.finance.simulator import (
    ScenarioDeltas,
    apply_deltas,
    build_snapshot,
)

ZERO = Decimal("0")
MIN_RECOMMENDED_BUFFER = Decimal("3")
DANGER_DEBT_RATIO = Decimal("0.40")

VERDICT_AFFORDABLE = "affordable"
VERDICT_CONDITIONAL = "possible_but_risky"
VERDICT_NOT_RECOMMENDED = "not_recommended"

DISCLAIMER = (
    "Advisory estimate based on your averaged income, expenses, savings and debt over the "
    "last 3 months. Real affordability may differ; this is not a loan or credit decision."
)


@dataclass
class PurchaseInput:
    amount: Decimal
    monthly_benefit_income: Decimal | None = None
    financing_amount: Decimal | None = None
    financing_interest_rate: Decimal | None = None
    financing_tenure_months: int | None = None


def _fmt(value: Decimal) -> str:
    return f"{value:,.2f}"


def assess(base: ReadinessInput, purchase: PurchaseInput, name: str | None = None) -> PurchaseAffordabilityResult:
    baseline = build_snapshot(base)
    missing: list[str] = []
    if base.income <= ZERO:
        missing.append("income history")
    if base.total_expenses <= ZERO:
        missing.append("expense history")
    insufficient = bool(missing)

    scenarios: list[PurchaseScenarioOut] = []
    overall_verdict = VERDICT_NOT_RECOMMENDED
    overall_headline = "Not enough financial information to evaluate this purchase."
    overall_detail = (
        "Add income and expense history so FinCompass can compare this purchase "
        "with your actual cash flow, savings and debt."
        + (f" Missing: {', '.join(missing)}." if missing else "")
    )
    if not insufficient:
        buy_now = _buy_now(base, baseline, purchase)
        save_first = _save_first(base, baseline, purchase)
        finance = _finance(base, baseline, purchase)
        scenarios.extend([buy_now, save_first, finance])
        overall_verdict = buy_now.verdict
        overall_headline = buy_now.headline
        overall_detail = buy_now.detail

    return PurchaseAffordabilityResult(
        name=name,
        amount=purchase.amount,
        insufficient_data=insufficient,
        missing_fields=missing,
        overall_verdict=overall_verdict,
        overall_headline=overall_headline,
        overall_detail=overall_detail,
        baseline=baseline,
        scenarios=scenarios,
        disclaimer=DISCLAIMER,
    )


def _health_delta_label(base: ReadinessInput, deltas: ScenarioDeltas, include_income_benefit: Decimal = ZERO) -> str:
    """Describe the health-score impact if the scenario were applied."""
    income_delta = deltas.income_delta + include_income_benefit
    adjusted = ScenarioDeltas(
        income_delta=income_delta,
        expenses_delta=deltas.expenses_delta,
        debt_delta=deltas.debt_delta,
        savings_contribution=deltas.savings_contribution,
        one_time_purchase=deltas.one_time_purchase,
    )
    before = compute_health(base).score
    after = compute_health(apply_deltas(base, adjusted)).score
    change = after - before
    if change == 0:
        return f"health score stays {before}"
    return f"health score {before} → {after} ({'+' if change > 0 else ''}{change})"


def _buy_now(base: ReadinessInput, baseline: BaselineSnapshot, purchase: PurchaseInput) -> PurchaseScenarioOut:
    amount = purchase.amount
    savings = base.savings
    remaining = savings - amount
    overdraft = remaining < ZERO
    buffer_after = None
    if base.essential_monthly_expenses > ZERO:
        buffer_after = float(remaining / base.essential_monthly_expenses)

    if overdraft:
        verdict = VERDICT_NOT_RECOMMENDED
        headline = "Not recommended from your current savings"
        detail = (
            f"This purchase would consume your entire savings balance and go into deficit "
            f"(savings {_fmt(savings)} − {_fmt(amount)} = {_fmt(remaining)}). "
            f"Your average surplus is only {_fmt(baseline.net_cash_flow)}/month, so the safest route is saving up (see Save-first)."
        )
    elif buffer_after is not None and buffer_after >= float(MIN_RECOMMENDED_BUFFER):
        verdict = VERDICT_AFFORDABLE
        headline = "Affordable from your current savings"
        detail = (
            f"After this purchase your savings fall from {_fmt(savings)} to {_fmt(remaining)}, "
            f"about {buffer_after:.1f} months of essential expenses (recommended buffer {MIN_RECOMMENDED_BUFFER}+ months). "
            f"You keep a positive surplus of {_fmt(baseline.net_cash_flow)}/month."
        )
    else:
        verdict = VERDICT_CONDITIONAL
        headline = "Possible, but it stretches your buffer"
        detail = (
            f"After this purchase your savings fall from {_fmt(savings)} to {_fmt(remaining)}, "
            f"leaving a buffer of {buffer_after:.1f} months' essential expenses (recommended {MIN_RECOMMENDED_BUFFER}+). "
            f"Only buy now if you can rebuild the balance quickly."
        )

    health_label = _health_delta_label(base, ScenarioDeltas(one_time_purchase=amount))
    return PurchaseScenarioOut(
        key="buy_now",
        verdict=verdict,
        headline=headline,
        detail=detail,
        monthly_impact=f"-{_fmt(amount)} one-time from savings",
        health_score_after=compute_health(apply_deltas(base, ScenarioDeltas(one_time_purchase=amount))).score,
        health_impact=health_label,
    )


def _save_first(base: ReadinessInput, baseline: BaselineSnapshot, purchase: PurchaseInput) -> PurchaseScenarioOut:
    surplus = baseline.net_cash_flow
    amount = purchase.amount

    if surplus <= ZERO:
        return PurchaseScenarioOut(
            key="save_first",
            verdict=VERDICT_NOT_RECOMMENDED,
            headline="No monthly surplus to save from yet",
            detail=(
                f"Your average cash flow after expenses and debt is {_fmt(surplus)}/month. "
                f"Reduce spending or add income first, then revisit this purchase."
            ),
            monthly_impact=f"{_fmt(surplus)}/month available",
            health_impact=_health_delta_label(base, ScenarioDeltas()),
        )

    months = int((amount / surplus).to_integral_value(rounding="ROUND_CEILING"))
    detail_lines = [
        f"Setting aside {_fmt(surplus)}/month from your surplus builds the full amount in about {months} month"
        f"{'' if months == 1 else 's'} — no extra interest cost.",
        f"During saving, your cash buffer stays at {baseline.buffer_months or 0:.1f} months of essentials.",
    ]
    if purchase.monthly_benefit_income and purchase.monthly_benefit_income > ZERO:
        payoff = int((amount / purchase.monthly_benefit_income).to_integral_value(rounding="ROUND_CEILING"))
        detail_lines.append(
            f"Buying now would add ~{_fmt(purchase.monthly_benefit_income)}/month, which could cover the cost "
            f"in about {payoff} month{'' if payoff == 1 else 's'} — weighing that against losing your buffer now."
        )
    verdict = VERDICT_AFFORDABLE
    headline = "Affordable by saving first"
    return PurchaseScenarioOut(
        key="save_first",
        verdict=verdict,
        headline=headline,
        detail=" ".join(detail_lines),
        monthly_impact=f"pinch {_fmt(surplus)}/month into savings",
        months_to_save=months,
        health_impact=_health_delta_label(base, ScenarioDeltas(savings_contribution=surplus)),
    )


def _finance(base: ReadinessInput, baseline: BaselineSnapshot, purchase: PurchaseInput) -> PurchaseScenarioOut:
    principal = purchase.financing_amount or purchase.amount
    rate = purchase.financing_interest_rate if purchase.financing_interest_rate is not None else ZERO
    tenure = purchase.financing_tenure_months or 12
    assumed_rate = purchase.financing_interest_rate is None
    emi = emi_result(principal, rate, tenure).monthly_emi

    new_debt = base.debt_payments + emi
    net_after = (base.income + (purchase.monthly_benefit_income or ZERO)) - base.total_expenses - new_debt
    debt_ratio = new_debt / base.income if base.income > ZERO else Decimal("0")

    if net_after < ZERO:
        verdict = VERDICT_NOT_RECOMMENDED
        headline = "Financing would push cash flow negative"
        detail = (
            f"At {_fmt(emi)}/month for {tenure} months, your total debt obligation becomes {_fmt(new_debt)}/month, "
            f"leaving monthly cash flow at {_fmt(net_after)} (expenses {_fmt(base.total_expenses)} + debt {_fmt(new_debt)} vs income {_fmt(base.income)}). "
            f"The EMI is more than your monthly surplus can cover."
        )
    elif debt_ratio > DANGER_DEBT_RATIO:
        verdict = VERDICT_CONDITIONAL
        headline = "Financing is risky at this debt level"
        detail = (
            f"The EMI of {_fmt(emi)}/month pushes debt to {debt_ratio:.0%} of income (safe zone: up to 40%). "
            f"Monthly cash flow stays positive at {_fmt(net_after)} only if the assumed benefit (if any) materialises. "
            f"Prefer saving up or a smaller financed amount."
        )
    else:
        verdict = VERDICT_AFFORDABLE
        headline = "Financing fits within your current capacity"
        rate_note = (
            " Interest was not provided, so EMI is principal spread equally (0% illustrative). "
            "Enter a real rate for a more accurate comparison."
            if assumed_rate
            else ""
        )
        detail = (
            f"At {_fmt(emi)}/month for {tenure} months, total debt stays at {debt_ratio:.0%} of income "
            f"and monthly cash flow remains positive at {_fmt(net_after)}. "
            f"Check shopkeeper/cooperative credit options before formal lenders.{rate_note}"
        )

    return PurchaseScenarioOut(
        key="finance",
        verdict=verdict,
        headline=headline,
        detail=detail,
        monthly_impact=f"-{_fmt(emi)}/month for {tenure} months",
        post_finance_cash_flow=net_after,
        health_impact=_health_delta_label(base, ScenarioDeltas(debt_delta=emi), include_income_benefit=purchase.monthly_benefit_income or ZERO),
        health_score_after=compute_health(apply_deltas(base, ScenarioDeltas(debt_delta=emi, income_delta=purchase.monthly_benefit_income or ZERO))).score,
    )