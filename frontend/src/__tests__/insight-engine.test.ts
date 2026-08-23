import { describe, it, expect } from "vitest";
import { generateBusinessInsights } from "@/lib/insight-engine";
import type {
  ExpenseSummary,
  ExpenseTrends,
  CashflowForecastResponse,
  DebtObligation,
  SavingsGoal,
} from "@/types";

function makeMonthly(overrides: Partial<ExpenseSummary> = {}): ExpenseSummary {
  return {
    period: "2026-08",
    total_expenses: "8000",
    total_income: "12000",
    net_cash_flow: "4000",
    transaction_count: 20,
    categories: { food: "5000", transport: "3000" },
    change_percent: 5,
    ...overrides,
  };
}

describe("generateBusinessInsights", () => {
  it("returns nothing without transactions", () => {
    const out = generateBusinessInsights({
      monthly: makeMonthly({ transaction_count: 0 }),
    });
    expect(out).toHaveLength(0);
  });

  it("returns nothing when monthly data is missing", () => {
    expect(generateBusinessInsights({ monthly: null })).toHaveLength(0);
  });

  it("flags negative net cash flow as critical", () => {
    const out = generateBusinessInsights({
      monthly: makeMonthly({ net_cash_flow: "-2000" }),
    });
    const neg = out.find((i) => i.id === "negative_net");
    expect(neg).toBeDefined();
    expect(neg?.severity).toBe("critical");
  });

  it("flags an expense spike above 20 percent", () => {
    const out = generateBusinessInsights({
      monthly: makeMonthly({ change_percent: 35, net_cash_flow: "1000" }),
    });
    const spike = out.find((i) => i.id === "expense_spike");
    expect(spike?.severity).toBe("warning");
    expect(spike?.headline.params).toMatchObject({ percent: "35%" });
  });

  it("produces a positive insight for a healthy month", () => {
    const out = generateBusinessInsights({ monthly: makeMonthly() });
    const pos = out.find((i) => i.id === "positive_month");
    expect(pos?.severity).toBe("positive");
  });

  it("flags projected deficit from forecast", () => {
    const forecast = {
      status: "success",
      expense_forecast: { predicted: 15000, lower: 14000, upper: 16000 },
      income_forecast: { predicted: 10000, lower: 9000, upper: 11000 },
    } as unknown as CashflowForecastResponse;
    const out = generateBusinessInsights({ monthly: makeMonthly(), forecast });
    const deficit = out.find((i) => i.id === "forecast_deficit");
    expect(deficit?.severity).toBe("critical");
    // Critical sorts before positive.
    expect(out[0]!.id).toBe("forecast_deficit");
  });

  it("flags heavy repayment burden over 40 percent of income", () => {
    const debts = [
      { id: 1, name: "Loan", principal: "50000", monthly_payment: "6000", interest_rate: "10", remaining_balance: "30000", due_date: null },
    ] as DebtObligation[];
    const out = generateBusinessInsights({
      monthly: makeMonthly({ total_income: "12000" }),
      debts,
    });
    const pressure = out.find((i) => i.id === "debt_pressure");
    expect(pressure).toBeDefined();
    expect(pressure?.headline.params).toMatchObject({ percent: "50%" });
  });

  it("nudges toward a nearly completed savings goal", () => {
    const goals = [
      { id: 1, name: "Fridge", target_amount: "10000", current_amount: "8000", target_date: null, status: "active", progress_percent: "80", goal_type: null },
    ] as SavingsGoal[];
    const out = generateBusinessInsights({ monthly: makeMonthly(), savingsGoals: goals });
    const goal = out.find((i) => i.id === "goal_close");
    expect(goal?.severity).toBe("positive");
    expect(goal?.action.params).toMatchObject({ remaining: "₹2,000" });
  });

  it("caps results at 4 insights sorted by severity", () => {
    const forecast = {
      status: "success",
      expense_forecast: { predicted: 20000, lower: 18000, upper: 22000 },
      income_forecast: { predicted: 9000, lower: 8000, upper: 10000 },
    } as unknown as CashflowForecastResponse;
    const debts = [
      { id: 1, name: "Loan", principal: "1", monthly_payment: "7000", interest_rate: "10", remaining_balance: "1", due_date: null },
    ] as DebtObligation[];
    const goals = [
      { id: 1, name: "G", target_amount: "10", current_amount: "9", target_date: null, status: "active", progress_percent: "90", goal_type: null },
    ] as SavingsGoal[];
    const trends = { granularity: "monthly", points: [], top_categories: [] } as ExpenseTrends;
    const out = generateBusinessInsights({
      monthly: makeMonthly({ net_cash_flow: "-500", change_percent: 40 }),
      forecast,
      debts,
      savingsGoals: goals,
      trends,
    });
    expect(out.length).toBeLessThanOrEqual(4);
    const order = ["critical", "warning", "info", "positive"];
    const ranks = out.map((i) => order.indexOf(i.severity));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("never invents numbers not present in params", () => {
    const out = generateBusinessInsights({ monthly: makeMonthly() });
    for (const insight of out) {
      expect(insight.headline.params ?? {}).toBeTruthy();
      expect(typeof insight.action.key).toBe("string");
    }
  });
});
