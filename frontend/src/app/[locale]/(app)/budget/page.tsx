"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { BudgetProgressList, ChartCard, PageError } from "@/components/charts/responsive-charts";
import { EmptyState } from "@/components/common/shared";
import { useBudgetStatus, useCreateBudget, useDeleteBudget, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";
import { Plus, Target, AlertTriangle, Wallet, PieChart, ShieldCheck } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialMetric } from "@/components/spatial/spatial-metric";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

export default function BudgetPage() {
  const t = useTranslations("budget");
  const tc = useTranslations("common");
  const period = format(new Date(), "yyyy-MM");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "", limit_amount: "" });
  const [error, setError] = useState("");

  const budget = useBudgetStatus(period);
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();
  const forecast = useMLForecast();

  const categoryForecasts = forecast.data?.category_forecasts ?? [];
  const hasForecastData = categoryForecasts.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createBudget.mutateAsync({ period: `${period}-01`, category: form.category, limit_amount: parseFloat(form.limit_amount) });
      setShowForm(false);
      setForm({ category: "", limit_amount: "" });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  const totalBudget = budget.data?.reduce((s, b) => s + toNumber(b.limit_amount), 0) ?? 0;
  const totalSpent = budget.data?.reduce((s, b) => s + toNumber(b.spent), 0) ?? 0;
  const totalRemaining = budget.data?.reduce((s, b) => s + toNumber(b.remaining), 0) ?? 0;
  const overBudgetCount = budget.data?.filter((b) => toNumber(b.percent_used) > 100).length ?? 0;

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="ALLOCATION PROTOCOL"
        title={t("title")}
        subtitle={`Active Fiscal Period: ${period}`}
        action={
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />{t("addBudget")}
          </Button>
        }
      />

      {/* High-Level Budget Metrics */}
      {budget.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <SpatialMetric
            label="Total Allocation"
            value={formatCurrency(totalBudget)}
            subtitle="Configured Monthly Cap"
            glow="cyan"
            icon={<Target className="h-4 w-4 text-cyan-400" />}
          />
          <SpatialMetric
            label="Current Outlay"
            value={formatCurrency(totalSpent)}
            subtitle={`${totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(0) : 0}% Utilized`}
            glow={totalSpent > totalBudget ? "rose" : "amber"}
            icon={<PieChart className="h-4 w-4 text-amber-400" />}
          />
          <SpatialMetric
            label="Available Buffer"
            value={formatCurrency(totalRemaining)}
            subtitle={totalRemaining >= 0 ? "Under Threshold" : "Overrun Detected"}
            glow={totalRemaining >= 0 ? "emerald" : "rose"}
            trend={totalRemaining >= 0 ? "up" : "down"}
            icon={<Wallet className="h-4 w-4 text-emerald-400" />}
          />
        </div>
      ) : null}

      {/* Add Budget Drawer */}
      {showForm && (
        <GlassPanel glow="cyan" hudCorners className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("addBudget")}</h3>
            <SpatialBadge variant="cyan">NEW ALLOCATION</SpatialBadge>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-text-secondary">{t("category")}</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 mt-1 rounded-xl border border-cyan-500/20 bg-surface-container px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-400"
                required
              >
                <option value="" disabled>{t("categoryPlaceholder")}</option>
                {CATEGORIES.filter((c) => c !== "income").map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("limit")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.limit_amount} onChange={(e) => setForm({ ...form, limit_amount: e.target.value })} required />
            </div>
            <div className="flex gap-3 sm:col-span-2 pt-2">
              <Button type="submit" disabled={createBudget.isPending} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6">
                {createBudget.isPending ? "SAVING..." : tc("save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-text-secondary">
                {tc("cancel")}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-xs font-mono text-rose-400">{error}</p>}
        </GlassPanel>
      )}

      {/* Progress Cards */}
      <ChartCard 
        title={t("title")}
        action={overBudgetCount > 0 ? (
          <SpatialBadge variant="rose">
            <AlertTriangle className="mr-1 h-3 w-3 inline" />{overBudgetCount} OVER BUDGET
          </SpatialBadge>
        ) : undefined}
      >
        {budget.isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : budget.isError ? (
          <PageError message={t("error")} />
        ) : budget.data?.length ? (
          <BudgetProgressList
            budgets={budget.data.map((b) => ({
              id: b.id,
              category: b.category,
              spent: toNumber(b.spent),
              limit: toNumber(b.limit_amount),
              percentUsed: toNumber(b.percent_used),
              remaining: toNumber(b.remaining),
            }))}
            onDelete={(id) => {
              if (!confirm(tc("confirm"))) return;
              void deleteBudget.mutateAsync(id as number).catch(() => setError(t("error")));
            }}
          />
        ) : (
          <EmptyState
            title="No budgets set yet"
            description={t("noBudgetsDesc")}
            icon={Target}
            action={
              <Button size="sm" onClick={() => setShowForm(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold">
                <Plus className="mr-1.5 h-3.5 w-3.5" />Create Budget
              </Button>
            }
          />
        )}
        {!budget.isLoading && !hasForecastData && budget.data?.length ? (
          <p className="text-xs font-mono text-text-muted text-center pt-3 border-t border-white/5 mt-3">{t("noForecastData")}</p>
        ) : null}
      </ChartCard>
    </div>
  );
}
