# Financial Engine

All monetary calculations use Python **`Decimal`**. The LLM never performs authoritative calculations.

## Core Functions

| Function | Module |
|----------|--------|
| Cash flow | `services/finance/cashflow.py` |
| Savings capacity | `services/finance/cashflow.py` |
| Emergency buffer | `services/finance/emergency_fund.py` |
| Debt burden | `services/finance/debt.py` |
| Expense analytics | `services/finance/expenses.py` |
| Budget | `services/finance/budget.py` |
| EMI | `services/lending/emi.py` |
| Loan simulation | `services/lending/loan_simulator.py` |
| Credit readiness | `services/readiness/engine.py` |
| Financial health score | `services/health/engine.py` |

## Credit Readiness (v1.0)

- Baseline score 50, clamped 0–100
- Seven explainable factors (documented in `engine.py` module docstring)
- **No protected characteristics** used
- Corrections via `POST /api/v1/credit-readiness/correct` with audit trail

## Financial Health Score (v1.0.0)

- Deterministic composite of five pillars (cash flow 25%, expense control
  20%, savings 20%, debt 20%, stability 15%), clamped 0–100
- **Not a credit score** (`is_credit_score: false`); labels Good ≥ 75,
  Moderate ≥ 50, Needs attention < 50
- Each pillar returns a scored value, `explanation`, and direction; the UI
  always shows *why* a number is what it is
- Persisted per computation with `previous_score`/`change` tracking
- See `docs/ML_SYSTEM.md` §4 for anchors and limitations

## Expense Analytics

- Weekly/monthly summaries with previous-period comparison
- Recurring pattern detection (salary, rent, EMI, subscriptions, utilities) with confidence labels
