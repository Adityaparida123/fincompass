# Engineering Report: ML Forecast Feature Audit, Fix, and Upgrade

**Date**: 2026-08-17
**Scope**: Full audit, fix, and upgrade of the ML Forecast feature in FinCompass
**Status**: Completed

---

## 1. Root Cause of Current ML Forecast Failure

The "No data available yet" message appeared because `cashflow_features.py:36` had `if len(monthly) < 2: return {}`, which blocked single-month data from producing any features. This caused the `CashflowForecaster.forecast()` method to return `insufficient_data` for any user with less than 2 months of history — the vast majority of new users. The frontend then fell through to the `tc("noData")` catch-all.

**Secondary issues**:
- The forecast only predicted **net cashflow**, not separated expenses/income or category breakdowns
- MongoDB dates are stored as ISO-8601 strings, and the `$gte` filter compared against a `date` object instead of an ISO string
- No budget/savings/recommendations integration existed

---

## 2. Files Changed (15 files, +801/-152 lines)

| File | Change |
|------|--------|
| `ml/features/cashflow_features.py` | Fixed single-month support; added `category_monthly_expenses()` and `category_forecasts()` |
| `ml/inference/forecast.py` | Complete rewrite: 3-layer forecast (expenses, income, net), category breakdown, quality labels, graceful degradation |
| `app/services/ml/service.py` | Fixed date serialization (`isoformat()` instead of raw `date` object); added new fields to degraded result |
| `app/api/routes/ml.py` | Pass through `expense_forecast`, `income_forecast`, `category_forecasts`, `forecast_quality` |
| `app/schemas/ml.py` | Added `ForecastRange`, `CategoryForecast` models; updated `CashflowForecastResponse` |
| `app/services/recommendations/engine.py` | Added `forecast_data` parameter; forecast-based budget alerts and category monitoring |
| `app/api/routes/recommendations.py` | Fetches ML forecast and passes to recommendations engine |
| `frontend/src/types/index.ts` | Added `ForecastRange`, `CategoryForecast` interfaces; updated `CashflowForecastResponse` |
| `frontend/src/app/[locale]/(app)/cashflow/page.tsx` | Full 3-layer forecast display: summary cards, category breakdown, quality badge |
| `frontend/src/app/[locale]/(app)/dashboard/page.tsx` | Compact forecast card: expenses, income, surplus with link to full view |
| `frontend/src/app/[locale]/(app)/budget/page.tsx` | Forecast vs budget comparison per category |
| `frontend/src/app/[locale]/(app)/savings/page.tsx` | Forecast surplus capacity insight card |
| `frontend/src/messages/en.json` | Added i18n keys for all new states |
| `ml/tests/test_inference.py` | 20 tests covering ML, baseline, single-month, category, deterministic net, quality labels |
| `ml/tests/test_features.py` | 10 tests covering single-month features, category forecasts, edge cases |

---

## 3. API Endpoint

**Endpoint**: `GET /api/v1/ml/cashflow-forecast`

**Authentication**: Bearer token + `financial_data_analysis` consent required

**Query Parameters**:
- `months_ahead` (optional, default: 1, range: 1-6)

---

## 4. Model Used

- **6+ months of history**: `RandomForestRegressor` (trained on synthetic Indian financial data via `ml/training/train_forecast.py`)
- **1-6 months of history**: Rolling average baseline (deterministic, no ML model needed)
- **0 months**: Returns `insufficient_data` response

**Model Artifacts**:
- Model: `ml/models/artifacts/cashflow_model.joblib`
- Features: `ml/models/artifacts/cashflow_features.joblib`
- Config: `ml/models/artifacts/training_config.joblib`

---

## 5. Fallback Method

When ML model is unavailable (`FileNotFoundError`) or insufficient data for ML (< 3 months), the system falls back to a rolling baseline using last-month values with trend adjustment:

```python
# Trend-based adjustment
expense_trend = (last_month - first_month) / max(len(monthly), 1)
predicted = last_expenses + (expense_trend * months_ahead)
```

For 1-month data, uses the single month's observed values directly with ±20% confidence band.

---

## 6. Forecast Methodology

**Expense Forecast**:
- If 2+ months: Last month's expenses + trend adjustment
- If 1 month: Single month's observed expenses

**Income Forecast**:
- If 2+ months: Last month's income + trend adjustment
- If 1 month: Single month's observed income

**Net Cash Flow**:
- Deterministic calculation: `income - expenses` (never ML-predicted)
- Ensures financial consistency for budgeting and savings decisions

**Category Forecasts**:
- Per-category monthly averages from historical expense data
- Categories: housing, food, transport, utilities, entertainment, shopping, health, education, other

---

## 7. Prediction Ranges

| Scenario | Lower Bound | Upper Bound |
|----------|-------------|-------------|
| ML model | `predicted - 1.5 × std_cashflow` | `predicted + 1.5 × std_cashflow` |
| Baseline (2+ months) | `predicted - 1.5 × std_cashflow` | `predicted + 1.5 × std_cashflow` |
| Baseline (1 month) | `predicted × 0.8` | `predicted × 1.2` |
| Category (2+ months) | `predicted - 1.5 × category_std` | `predicted + 1.5 × category_std` |
| Category (1 month) | `predicted × 0.8` | `predicted × 1.2` |

---

## 8. Insufficient History Handling

| History | Response Method | Quality Label | UI Message |
|---------|-----------------|---------------|------------|
| 0 months | `insufficient_data` | N/A | "Import transactions to see your forecast" |
| 1 month | `rolling_baseline` | `"limited"` | "Estimated forecast — limited transaction history" |
| 2 months | `rolling_baseline` | `"limited"` | "Estimated forecast — limited transaction history" |
| 3-5 months | `rolling_baseline` or `ml_model` | `"moderate"` | "Moderate forecast — improving accuracy" |
| 6+ months | `ml_model` | `"good"` | "Reliable forecast — based on 6+ months of data" |

---

## 9. Feature Integrations

### Dashboard
- Compact forecast card showing: expected expenses, income, surplus
- "[View forecast]" link to full cash flow page
- Graceful handling of insufficient data states

### Cash Flow
- Full 3-layer forecast display with summary cards
- Category breakdown chart showing expense predictions per category
- Quality badge and baseline explanation

### Budget
- Per-category forecast vs budget comparison
- Alert: "Forecast is ₹1,500 above your food budget"
- Helps users adjust budgets based on predicted spending

### Savings
- Projected surplus capacity insight
- Message: "You may be able to allocate approximately ₹25,000 toward savings"
- Encourages savings goal setting

### Recommendations
- Forecast-based alerts: projected expenses > income
- Category monitoring suggestions
- Cross-feature integration with readiness data

---

## 10. Tests Performed

| Suite | Tests | Result |
|-------|-------|--------|
| ML feature tests (`ml/tests/test_features.py`) | 10 | **All pass** |
| ML inference tests (`ml/tests/test_inference.py`) | 20 | **All pass** |
| Backend integration tests (`tests/integration/`) | 118 | **All pass** (4 skipped: real MongoDB) |
| Python lint (ruff) | N/A | **Clean** (only pre-existing B008 warnings) |
| TypeScript checks (`tsc --noEmit`) | N/A | **Clean** |

**Total**: 148 tests passing, 0 failures

---

## 11. Example API Response

```json
{
  "status": "success",
  "method": "rolling_baseline",
  "forecasts": [
    {
      "forecast_month": "2026-09",
      "expected_cashflow": 17000,
      "lower_range": 8500,
      "upper_range": 25500
    }
  ],
  "expense_forecast": {
    "predicted": 33000,
    "lower": 28000,
    "upper": 38000
  },
  "income_forecast": {
    "predicted": 50000,
    "lower": 45000,
    "upper": 55000
  },
  "category_forecasts": [
    {
      "category": "housing",
      "predicted": 12000,
      "lower": 12000,
      "upper": 12000,
      "months_of_data": 1
    },
    {
      "category": "food",
      "predicted": 4500,
      "lower": 3600,
      "upper": 5400,
      "months_of_data": 1
    }
  ],
  "forecast_quality": "limited",
  "confidence": 0.3,
  "explanation": [
    {
      "factor": "method",
      "impact": "medium",
      "description": "Based on 1 month(s) of data using rolling average baseline. Limited transaction history affects forecast accuracy."
    }
  ],
  "model": {
    "name": "cashflow_forecaster",
    "version": "1.0.0",
    "feature_version": "1.0"
  },
  "timestamp": "2026-08-17T10:30:00Z"
}
```

---

## 12. Remaining Limitations

1. **ML model trained on synthetic data**: The RandomForest was trained on generated Indian financial data, not real user transactions. For production, retrain with real anonymized data.

2. **No persistent forecast cache**: Forecasts are computed per-request with in-process cache. For production, consider Redis caching with TTL.

3. **Category forecasts use simple averaging**: No seasonality or trend modeling per category yet. Sufficient for baseline but could be improved with 6+ months of real data.

4. **sklearn version mismatch**: Model artifacts were pickled with sklearn 1.9.0 but runtime has 1.8.0 (warnings only, not errors). Recompile artifacts with matching version for production.

5. **Budget comparison is frontend-only**: The forecast-budget comparison happens in the UI layer. The backend recommendations engine receives forecast data but budget limits aren't cross-referenced server-side yet.

6. **No user feedback loop**: Forecast accuracy isn't tracked against actual spending. Consider adding feedback mechanisms to improve model over time.

7. **No multi-currency support**: Forecasts assume single currency (INR). Adding currency conversion would require exchange rate integration.

---

## Conclusion

The ML Forecast feature has been fully audited, fixed, and upgraded from a broken single-prediction system to a comprehensive 3-layer forecasting engine with:

- **Fixed root cause**: Single-month data now produces valid forecasts
- **Enhanced predictions**: Separate expense/income forecasts with deterministic net cash flow
- **Category-level insights**: Per-category expense predictions
- **Cross-feature integration**: Dashboard, Budget, Savings, and Recommendations all leverage forecast data
- **Graceful degradation**: Clear handling of insufficient data with quality labels
- **Comprehensive testing**: 148 tests covering all scenarios

The feature is production-ready for deployment with synthetic ML models. For optimal accuracy, retrain models with real anonymized transaction data once available.
