import { describe, it, expect } from "vitest";
import { buildActionPlans, groupByPriority } from "@/lib/action-plan";
import type { Recommendation } from "@/types";

function rec(type: string, priority: number, title: string): Recommendation {
  return { type, priority, title, reason: `reason for ${title}` };
}

describe("buildActionPlans", () => {
  it("buckets urgent items as high priority", () => {
    const plans = buildActionPlans([
      rec("income", 1, "Track income"),
      rec("budgeting", 2, "Review essentials"),
    ]);
    const grouped = groupByPriority(plans);
    expect(grouped.high.map((i) => i.title)).toEqual(["Track income", "Review essentials"]);
  });

  it("lifts schemes into the opportunity bucket", () => {
    const plans = buildActionPlans([rec("schemes", 6, "Check public schemes")]);
    expect(plans[0].priority).toBe("opportunity");
  });

  it("sorts non-credit alternatives into opportunity", () => {
    const plans = buildActionPlans([rec("non_credit_alternatives", 7, "Alternatives first")]);
    expect(plans[0].priority).toBe("opportunity");
  });

  it("keeps monitoring-style recs in monitor bucket", () => {
    const plans = buildActionPlans([
      rec("forecast_alert", 8, "Projected deficit"),
      rec("category_forecast", 9, "Monitor food"),
      rec("responsible_borrowing", 10, "Borrow carefully"),
    ]);
    const grouped = groupByPriority(plans);
    expect(grouped.monitor).toHaveLength(3);
  });

  it("preserves backend priority ordering within a bucket", () => {
    const plans = buildActionPlans([
      rec("savings", 5, "Automate savings"),
      rec("emergency_fund", 4, "Build emergency fund"),
    ]);
    expect(plans.map((i) => i.title)).toEqual(["Build emergency fund", "Automate savings"]);
  });

  it("handles empty input", () => {
    expect(buildActionPlans([])).toEqual([]);
  });
});