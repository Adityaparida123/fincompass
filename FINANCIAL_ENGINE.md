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

## Credit Readiness (v1.0)

- Baseline score 50, clamped 0–100
- Seven explainable factors (documented in `engine.py` module docstring)
- **No protected characteristics** used
- Corrections via `POST /api/v1/credit-readiness/correct` with audit trail

## Expense Analytics

- Weekly/monthly summaries with previous-period comparison
- Recurring pattern detection (salary, rent, EMI, subscriptions, utilities) with confidence labels
