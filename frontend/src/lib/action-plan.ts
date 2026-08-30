import type { Recommendation } from "@/types";

export type ActionPriority = "high" | "medium" | "opportunity" | "monitor";

export interface ActionPlanItem {
  priority: ActionPriority;
  priorityNumber: number;
  title: string;
  reason: string;
  type: string;
}

const PRIORITY_ORDER: Record<ActionPriority, number> = {
  high: 0,
  medium: 1,
  opportunity: 2,
  monitor: 3,
};

/**
 * Group backend recommendations into an at-a-glance action plan.
 *
 * The backend engine already sorts items by priority (ascending from 1):
 *   1-2  urgent, act this month
 *   3+   steady habits and buffers
 *
 * We additionally lift scheme/alternative recommendations into their own
 * "opportunity" group and monitoring-style items (forecasts, responsible
 * borrowing, low-priority debt) into "monitor" so the dashboard reads as a
 * plan rather than a flat list. The grouping never reorders within a bucket:
 * original priority ordering is preserved.
 */
export function buildActionPlans(recommendations: Recommendation[]): ActionPlanItem[] {
  const items: ActionPlanItem[] = recommendations.map((r) => {
    let priority: ActionPriority;
    if (["schemes", "non_credit_alternatives"].includes(r.type)) {
      priority = "opportunity";
    } else if (["responsible_borrowing", "forecast_alert", "category_forecast"].includes(r.type)) {
      priority = "monitor";
    } else if (r.priority <= 2) {
      priority = "high";
    } else {
      priority = "medium";
    }
    return { priority, priorityNumber: r.priority, title: r.title, reason: r.reason, type: r.type };
  });

  return items.sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (byPriority !== 0) return byPriority;
    return a.priorityNumber - b.priorityNumber;
  });
}

export function groupByPriority(items: ActionPlanItem[]): Record<ActionPriority, ActionPlanItem[]> {
  return {
    high: items.filter((i) => i.priority === "high"),
    medium: items.filter((i) => i.priority === "medium"),
    opportunity: items.filter((i) => i.priority === "opportunity"),
    monitor: items.filter((i) => i.priority === "monitor"),
  };
}