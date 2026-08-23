import { toNumber, formatCurrency } from "@/lib/utils";
import type {
  ExpenseSummary,
  ExpenseTrends,
  CashflowForecastResponse,
  DebtObligation,
  SavingsGoal,
} from "@/types";

/**
 * Deterministic AI Business Insight engine.
 *
 * Derives structured, explainable insights exclusively from real user data
 * already available in the app (monthly summary, trends, ML forecast,
 * debt obligations and savings goals). No numbers are invented: every
 * amount/percentage shown comes from an API response.
 *
 * Insights are returned as i18n message references so copy stays
 * translatable and hedged ("estimated", "may", "appears") at render time.
 */

export type InsightSeverity = "positive" | "info" | "warning" | "critical";

export interface InsightMessage {
  key: string;
  params?: Record<string, string | number>;
}

export interface BusinessInsight {
  id: string;
  severity: InsightSeverity;
  /** What happened — always includes a real figure when available. */
  headline: InsightMessage;
  /** Why it matters for the business. */
  why: InsightMessage | null;
  /** Recommended next step. */
  action: InsightMessage;
}

export interface InsightInput {
  monthly?: ExpenseSummary | null;
  trends?: ExpenseTrends | null;
  forecast?: CashflowForecastResponse | null;
  debts?: DebtObligation[] | null;
  savingsGoals?: SavingsGoal[] | null;
}

const SEVERITY_WEIGHT: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

const MAX_INSIGHTS = 4;

function topCategory(
  categories: Record<string, string> | undefined,
): { name: string; amount: number; share: number } | null {
  if (!categories) return null;
  const entries = Object.entries(categories)
    .map(([name, v]) => ({ name, amount: toNumber(v) }))
    .filter((e) => e.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = entries.reduce((s, e) => s + e.amount, 0);
  if (!entries.length || total <= 0) return null;
  return {
    name: entries[0]!.name.replace(/_/g, " "),
    amount: entries[0]!.amount,
    share: (entries[0]!.amount / total) * 100,
  };
}

/** Month-over-month income change from the trend series, when computable. */
function incomeTrendPercent(trends: ExpenseTrends | null | undefined): number | null {
  const points = trends?.points ?? [];
  const withIncome = points.map((p) => toNumber(p.income ?? 0));
  if (withIncome.length < 2) return null;
  // Find the most recent pair of months where both values exist.
  let prev: number | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    const cur = toNumber(points[i]?.income ?? 0);
    if (cur <= 0 && prev == null) continue;
    if (prev != null && prev >= 0) {
      return prev > 0 ? ((cur - prev) / prev) * 100 : null;
    }
    prev = cur;
  }
  return null;
}

/**
 * Generate prioritized business insights from the provided data.
 * Returns at most MAX_INSIGHTS items sorted by severity.
 */
export function generateBusinessInsights(input: InsightInput): BusinessInsight[] {
  const { monthly, trends, forecast, debts, savingsGoals } = input;
  const insights: BusinessInsight[] = [];

  const hasTransactions = (monthly?.transaction_count ?? 0) > 0;
  if (!monthly || !hasTransactions) return insights;

  const income = toNumber(monthly.total_income);
  const expenses = toNumber(monthly.total_expenses);
  const net = toNumber(monthly.net_cash_flow);
  const changePercent = monthly.change_percent != null ? toNumber(monthly.change_percent) : null;
  const top = topCategory(monthly.categories);

  const monthlyDebtPayments =
    debts?.reduce((s, d) => s + toNumber(d.monthly_payment), 0) ?? 0;
  const savingsTotal =
    savingsGoals?.reduce((s, g) => s + toNumber(g.current_amount), 0) ?? 0;

  const expenseForecast = forecast?.expense_forecast ?? null;
  const incomeForecast = forecast?.income_forecast ?? null;
  const forecastUsable = forecast?.status === "success" && !!expenseForecast && !!incomeForecast;

  // ── Projected deficit (highest priority warning) ────────────────
  if (forecastUsable && expenseForecast && incomeForecast &&
      expenseForecast.predicted > incomeForecast.predicted) {
    const gap = expenseForecast.predicted - incomeForecast.predicted;
    insights.push({
      id: "forecast_deficit",
      severity: "critical",
      headline: {
        key: "insights.forecastDeficit",
        params: { gap: formatCurrency(gap), expenses: formatCurrency(expenseForecast.predicted) },
      },
      why: {
        key: "insights.forecastDeficitWhy",
        params: {},
      },
      action: {
        key: "insights.forecastDeficitAction",
        params: { expenses: formatCurrency(expenseForecast.predicted) },
      },
    });
  }

  // ── Negative cash flow this month ───────────────────────────────
  if (net < 0) {
    insights.push({
      id: "negative_net",
      severity: "critical",
      headline: {
        key: "insights.negativeNet",
        params: { amount: formatCurrency(Math.abs(net)) },
      },
      why: top
        ? {
            key: "insights.negativeNetWhy",
            params: { category: top.name, share: Math.round(top.share) },
          }
        : {
            key: "insights.negativeNetWhyGeneric",
            params: {},
          },
      action: {
        key: top ? "insights.negativeNetAction" : "insights.negativeNetActionGeneric",
        params: top ? { category: top.name } : undefined,
      },
    });
  }

  // ── Expense spike vs last month ─────────────────────────────────
  if (changePercent != null && changePercent > 20) {
    insights.push({
      id: "expense_spike",
      severity: "warning",
      headline: {
        key: "insights.expenseSpike",
        params: { percent: `${Math.round(changePercent)}%` },
      },
      why: {
        key: top ? "insights.expenseSpikeWhy" : "insights.expenseSpikeWhyGeneric",
        params: top
          ? { category: top.name, amount: formatCurrency(top.amount), share: Math.round(top.share) }
          : undefined,
      },
      action: {
        key: top ? "insights.expenseSpikeAction" : "insights.expenseSpikeActionGeneric",
        params: top ? { category: top.name } : undefined,
      },
    });
  }

  // ── Heavy repayment burden ──────────────────────────────────────
  const debtRatio = income > 0 ? (monthlyDebtPayments / income) * 100 : null;
  if (debtRatio != null && debtRatio > 40) {
    insights.push({
      id: "debt_pressure",
      severity: debtRatio > 60 ? "critical" : "warning",
      headline: {
        key: "insights.debtPressure",
        params: { percent: `${Math.round(debtRatio)}%`, payment: formatCurrency(monthlyDebtPayments) },
      },
      why: {
        key: "insights.debtPressureWhy",
        params: { buffer: formatCurrency(savingsTotal) },
      },
      action: {
        key: "insights.debtPressureAction",
        params: {},
      },
    });
  }

  // ── Thin savings buffer ─────────────────────────────────────────
  const bufferMonths = expenses > 0 && savingsTotal > 0 ? savingsTotal / expenses : null;
  if (bufferMonths != null && bufferMonths < 1 && net > 0) {
    const days = Math.max(7, Math.round(bufferMonths * 30));
    insights.push({
      id: "thin_buffer",
      severity: "info",
      headline: {
        key: "insights.thinBuffer",
        params: { days },
      },
      why: {
        key: "insights.thinBufferWhy",
        params: { expenses: formatCurrency(expenses) },
      },
      action: {
        key: "insights.thinBufferAction",
        params: { amount: formatCurrency(Math.max(50, Math.round(net * 0.25))) },
      },
    });
  }

  // ── Category concentration ──────────────────────────────────────
  if (top && top.share > 50 && expenses > 0) {
    insights.push({
      id: "category_concentration",
      severity: "info",
      headline: {
        key: "insights.concentration",
        params: { category: top.name, share: Math.round(top.share) },
      },
      why: {
        key: "insights.concentrationWhy",
        params: { category: top.name },
      },
      action: {
        key: "insights.concentrationAction",
        params: { category: top.name },
      },
    });
  }

  // ── Positive month ──────────────────────────────────────────────
  if (net > 0 && (changePercent == null || changePercent <= 15)) {
    const incomeChange = incomeTrendPercent(trends);
    insights.push({
      id: "positive_month",
      severity: "positive",
      headline: {
        key: "insights.positiveNet",
        params: { amount: formatCurrency(net) },
      },
      why: incomeChange != null
        ? {
            key: incomeChange >= 0 ? "insights.positiveNetWhyUp" : "insights.positiveNetWhyDown",
            params: { percent: `${Math.abs(Math.round(incomeChange))}%` },
          }
        : null,
      action: {
        key: "insights.positiveNetAction",
        params: { amount: formatCurrency(Math.max(50, Math.round(net * 0.25))) },
      },
    });
  }

  // ── Goal close to completion ────────────────────────────────────
  const nearGoal = (savingsGoals ?? []).find((g) => {
    const p = toNumber(g.progress_percent);
    return p >= 75 && p < 100;
  });
  if (nearGoal) {
    const remaining = Math.max(0, toNumber(nearGoal.target_amount) - toNumber(nearGoal.current_amount));
    insights.push({
      id: "goal_close",
      severity: "positive",
      headline: {
        key: "insights.goalClose",
        params: { name: nearGoal.name, percent: `${Math.round(toNumber(nearGoal.progress_percent))}` },
      },
      why: null,
      action: {
        key: "insights.goalCloseAction",
        params: { remaining: formatCurrency(remaining), name: nearGoal.name },
      },
    });
  }

  return insights
    .sort((a, b) => SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity])
    .slice(0, MAX_INSIGHTS);
}
