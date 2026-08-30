# ML System

This document describes how FinCompass turns a user's **recorded transactions**
into machine-learning and analytical outputs, and how every number is
explained. The guiding principle is: **the model does not decide anything
alone — every output is a deterministic function of the user's own data, and
every surfaced number carries its source and limitations.**

The LLM (FinAI) explains outputs in plain language but **never recomputes or
invents figures**; all authoritative calculations happen in deterministic
backend functions (`app/services/finance/`, `app/services/readiness/`,
`app/services/health/`) and ML inference (`ml/inference/`).

---

## 1. Data sources

| Data | Source | Notes |
|------|--------|-------|
| Transactions | `transactions` collection | Manual entry, bank/UPI/card, or bank-statement import |
| Debt obligations | `debt_obligations` | Sum of `monthly_payment` feeds all income-ratio metrics |
| Savings goals | `savings_goals` | Sum of active goals' `current_amount` (the "saved" figure) |
| Business profile | `users.business` | Self-reported, optional, all labels user-stated |
| Category policy | `ml/config.py` + keyword rules | Rule-based categorization with ML fallback |

**Consent:** every personalized endpoint requires the relevant
`ConsentType` (`financial_data_analysis`, `personalized_recommendations`,
`chat_financial_context`, `ml_analysis`). Revoked consent hard-stops the
feature (returns 403) and no personalized output is produced.

---

## 2. Transaction categorization

- Deterministic keyword rules define the base vocabulary
  (`app/services/import_statement/categorize.py`), matching categories such as
  `income`, `food`, `groceries`, `transport`, `housing`, `utilities`,
  `healthcare`, `education`, `shopping`, `debt_payment`, `savings`.
- Statement imports pass every row through the existing on-device classifier
  (`app/services/ml/service.categorize_transaction`, scikit-learn) when no
  keyword rule matches.
- Each category decision carries a **confidence tier**:
  `high` (0.95–1.00), `good` (0.80–0.94), `medium/needs review`
  (0.60–0.79), `low` (<0.60).
- User corrections persist via `save_category_correction` and feed retraining;
  every correction is audit-logged.
- Essential vs discretionary classification (used by expense-control,
  emergency-buffer and readiness metrics) comes from
  `app/schemas/transaction.py::is_essential`.

**Business/personal split** (`app/services/finance/scope.py`): a deterministic
category↔scope map guards against misclassification; users can override any row
(`expense_scope`) and the override is preserved.

---

## 3. Cash-flow forecasting

`ml/inference/forecast.py` supports **three tiers**, chosen only by the amount
of history available:

| Tiers | Requirement | Method |
|-------|-------------|--------|
| **ML model** | ≥ 3 months (`MIN_MONTHS_FOR_FORECAST`) | RandomForest `cashflow_forecaster.joblib` trained on synthetic + production-style data |
| **Rolling baseline** | 1–2 months | Simple moving average of income/expenses with a symmetric range |
| **Insufficient data** | none | Structured response explaining what is needed |

Output shape (documented in `app/schemas/ml.py`):

- `forecasts[]` — next-month expected net cash flow with `lower_range` /
  `upper_range` (net = income − expenses, deterministic)
- `expense_forecast`, `income_forecast` — predicted, lower, upper
- `category_forecasts[]` — per-category next-month predictions
- `forecast_quality` ∈ {`good`, `moderate`, `limited`, `none`}
- `explanation[]` — human-readable bullets explaining **why** the number is
  what it is

If the model artifact is missing, the system degrades gracefully to the
rolling baseline rather than failing the request. Forecasts are labelled
"estimates" in the UI and links to the source method each time.

---

## 4. Financial Health Score (v1.0.0)

`app/services/health/engine.py` — a **deterministic, explainable composite**
over five pillars, computed purely from the user's observed data. It is
**not a credit score** (`is_credit_score: false` is returned and asserted in
tests).

| Pillar | Weight | Scoring anchors |
|--------|--------|-----------------|
| `cash_flow` | 25% | Surplus/income ratio: ≥ +20% → 100, ≤ −10% → 0 |
| `expense_control` | 20% | Essential share ≤ 50% → 100, ≥ 90% → 0, minus volatility penalty (≤ 10) |
| `savings` | 20% | Effective savings rate ≥ 30% → 100, ≤ 0% → 0 |
| `debt` | 20% | Debt/income ratio ≤ 10% → 100, ≥ 40% → 0 |
| `stability` | 15% | Income CV ≤ 10% → 100, ≥ 50% → 0 (< 2 active months → neutral 50) |

Composite = Σ(pillar × weight), clamped to 0–100. Labels: **Good** ≥ 75,
**Moderate** ≥ 50, **Needs attention** < 50. Output also exposes each pillar's
`value`, `explanation`, and `direction` so the UI can say *why*.

Notes:
- Pillars are pure functions of `ReadinessInput` (built from the last 3
  months of transactions + debt + savings), so identical data → identical
  score.
- The score is **persisted** (`financial_health_scores` + per-factor rows);
  each computation records `previous_score` / `change`, and a change ≥ ±5
  triggers a silent notification.
- `insufficient_data=true` when there is no income, no expenses, no debt and
  no savings yet — the UI shows "not enough data" instead of a misleading
  number.

---

## 5. Credit Readiness (v1.0)

`app/services/readiness/engine.py` — seven explainable factors around a
baseline of 50 (see module docstring): `cash_flow_stability`,
`income_consistency`, `savings_capacity`, `emergency_buffer`,
`existing_debt_burden`, `repayment_affordability`, `expense_volatility`.

- No protected characteristics are used.
- Corrections flow through `POST /api/v1/credit-readiness/correct` with an
  audit trail.
- Readiness is **distinct** from the financial health score: health is a
  personal resilience snapshot; readiness models credit-worthiness signals.

---

## 6. Recommendations engine

`app/services/recommendations/engine.py` derives an ordered action plan from
`ReadinessInput` (and optional forecast data). Each recommendation belongs to a
typed action (`savings`, `schemes`, `responsible_borrowing`,
`forecast_alert`, `category_forecast`, …) and carries a `reason` and a
priority. The frontend groups them into four buckets:

- **High priority** — cash-flow protection
- **Steady habits** — routine improvements
- **Opportunities** — schemes & alternatives
- **Monitor** — forecast alerts and category trends

Recommendations never assert eligibility or pricing for external schemes; the
UI and FinAI always instruct users to verify at official sources.

---

## 7. FinAI context & tool flow

`app/ai/` pipeline: user question → intent router → context retrieval →
tool selection → deterministic tool → result → LLM explanation → safety
validation → response (streamed SSE).

- **Context retrieval** (`app/services/finance/context.py`) assembles the
  user's actual numbers: monthly income/expenses, savings, debt, business
  profile (self-reported labels only), and — for the `health` intent — the
  current health score and its pillars.
- **Tools** (`app/ai/tools.py`) include EMI, loan simulation, cash-flow
  summary, expenses, budget, debt, emergency buffer, credit readiness,
  schemes, ML spending patterns, ML cash-flow forecast, ML savings capacity,
  financial summary, and `calculate_financial_health`.
- Fallback (no LLM configured) returns structured tool-based answers so the
  chat feature still works.
- Hindi/Hinglish (including code-switching) is handled at the router/prompt
  level.

---

## 8. Labelling and honesty rules

- **Demo data** is created by `scripts/seed_demo_data.py` and sets
  `business.demo_synthetic: true` and `demo_synthetic` on the profile so it
  is distinguishable from real customer data; it is never displayed as a
  customer result.
- All ML and analytical outputs are called **estimates/indicators** in the UI;
  nothing is presented as a score issued by a credit bureau or a government
  body.
- Eligibility and pricing for external schemes must be verified by the user
  at official sources; the product never fabricates either.

---

## 9. Tests

- Backend: `pytest` (unit + integration; in-memory mongomock facade)
  covering the health engine (weights, bounds, monotonicity, determinism),
  the health route (auth + consent gating, persistence, change tracking),
  readiness, recommendations, ML service degradation, and import statement
  summary fields.
- ML: `ml/tests/` for forecast tiers, quality labels, category forecasts, and
  schema shape.
- Frontend: `vitest` for the action-plan bucket grouping, follow-up
  generation, and insight-engine logic.

See `FINANCIAL_ENGINE.md`, `AI_ARCHITECTURE.md`, and `ml/README.md` for
adjacent details.