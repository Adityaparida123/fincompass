"""Advisory endpoints: purchase affordability and what-if scenarios."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.db.enums import ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.advisor import (
    PurchaseAffordabilityRequest,
    PurchaseAffordabilityResult,
    ScenarioRequest,
    ScenarioSimulationResult,
)
from app.services.consent.service import require_consent
from app.services.finance.purchase_advisor import PurchaseInput, assess
from app.services.finance.simulator import (
    ScenarioDeltas,
    apply_deltas,
    build_snapshot,
    risk_label,
    fmt_value,
)
from app.services.readiness.factors import build_readiness_input

router = APIRouter(prefix="/advisor", tags=["advisor"])


@router.get("/snapshot", response_model=ScenarioSimulationResult)
async def financial_snapshot(
    db: MongoDatabase = Depends(get_session),
    user: Doc = Depends(get_current_user),
) -> ScenarioSimulationResult:
    """Read-only current averaged position used as the what-if baseline."""
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    base = await build_readiness_input(db, user.id)
    missing: list[str] = []
    if base.income <= 0:
        missing.append("income history")
    if base.total_expenses <= 0:
        missing.append("expense history")
    snapshot = build_snapshot(base)
    return ScenarioSimulationResult(
        insufficient_data=bool(missing),
        missing_fields=missing,
        label="current",
        baseline=snapshot,
        scenario=snapshot,
        score_change=0,
        risk_before=risk_label(base, snapshot),
        risk_after=risk_label(base, snapshot),
        why=[],
        disclaimer=(
            "Snapshot of averaged 3-month income, expenses, savings and debt. "
            "Nothing is written to your data."
        ),
    )


@router.post("/purchase-affordability", response_model=PurchaseAffordabilityResult)
async def purchase_affordability(
    data: PurchaseAffordabilityRequest,
    db: MongoDatabase = Depends(get_session),
    user: Doc = Depends(get_current_user),
) -> PurchaseAffordabilityResult:
    """Estimate whether the user can afford a purchase (no DB writes)."""
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    base = await build_readiness_input(db, user.id)
    purchase = PurchaseInput(
        amount=data.amount,
        monthly_benefit_income=data.monthly_benefit_income,
        financing_amount=data.financing_amount,
        financing_interest_rate=data.financing_interest_rate,
        financing_tenure_months=data.financing_tenure_months,
    )
    return assess(base, purchase, name=data.name)


@router.post("/scenario", response_model=ScenarioSimulationResult)
async def simulate_scenario(
    data: ScenarioRequest,
    db: MongoDatabase = Depends(get_session),
    user: Doc = Depends(get_current_user),
) -> ScenarioSimulationResult:
    """What-if simulation of income/expense/debt/savings changes. Read-only."""
    await require_consent(db, user.id, ConsentType.financial_data_analysis)
    base = await build_readiness_input(db, user.id)

    missing: list[str] = []
    if base.income <= 0:
        missing.append("income history")
    if base.total_expenses <= 0:
        missing.append("expense history")
    insufficient = bool(missing)

    baseline = build_snapshot(base)
    if insufficient:
        scenario = baseline
        score_change = 0
        risk_before = risk_after = "insufficient_data"
        why: list = []
    else:
        deltas = ScenarioDeltas(
            income_delta=data.income_delta,
            expenses_delta=data.expenses_delta,
            debt_delta=data.debt_delta,
            savings_contribution=data.savings_contribution,
            one_time_purchase=data.one_time_purchase,
        )
        adjusted = apply_deltas(base, deltas)
        scenario = build_snapshot(adjusted)
        score_change = (scenario.health_score or 0) - (baseline.health_score or 0)
        risk_before = risk_label(base, baseline)
        risk_after = risk_label(adjusted, scenario)
        why = _why_changes(baseline, scenario)

    return ScenarioSimulationResult(
        insufficient_data=insufficient,
        missing_fields=missing,
        label=data.label,
        baseline=baseline,
        scenario=scenario,
        score_change=score_change,
        risk_before=risk_before,
        risk_after=risk_after,
        why=why,
        disclaimer=(
            "Simulation is based on your averaged 3-month income, expenses, savings and debt. "
            "It models likely direction, not a guaranteed outcome. Nothing is written to your data."
        ),
    )


def _why_changes(before, after):
    from app.schemas.advisor import WhyChange

    rows: list[WhyChange] = []

    def fmt_pair(key: str, label: str, reason: str) -> None:
        b = fmt_value(getattr(before, key))
        a = fmt_value(getattr(after, key))
        if b != a:
            rows.append(WhyChange(factor=key, label=label, before=b, after=a, reason=reason))

    fmt_pair("income", "Income", "Change in monthly income raises/lowers available cash flow and savings capacity.")
    fmt_pair("total_expenses", "Expenses", "Higher spending reduces the monthly surplus available to save.")
    fmt_pair("debt_payments", "Debt payments", "Additional debt obligations reduce cash flow and increase debt burden.")
    fmt_pair("savings_balance", "Savings balance", "Savings contributions and one-time purchases change the cash buffer.")
    return rows