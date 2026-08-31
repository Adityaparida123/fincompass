"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { EmptyState } from "@/components/common/shared";
import { useSavingsGoals, useCreateSavingsGoal, useMLSavingsCapacity, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber, clampPercent } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import type { SavingsGoal, SavingsGoalType } from "@/types";
import { PiggyBank, Plus, Sparkles, Target, Vault, TrendingUp } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";
import { SavingsVault } from "@/components/3d/savings-vault";

const GOAL_TYPES: SavingsGoalType[] = [
  "emergency_fund",
  "equipment",
  "inventory",
  "business_expansion",
  "seasonal_expense",
  "personal",
];

function estimatedMonthlyContribution(goal: SavingsGoal): number | null {
  const remaining = toNumber(goal.target_amount) - toNumber(goal.current_amount);
  if (remaining <= 0 || !goal.target_date) return null;
  const months = Math.ceil(
    (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30),
  );
  if (months <= 0) return null;
  return Math.ceil(remaining / months);
}

function SavingsGoalCard({ goal }: { goal: SavingsGoal }) {
  const t = useTranslations("savings");
  const currentAmount = toNumber(goal.current_amount);
  const targetAmount = toNumber(goal.target_amount);
  const progress = clampPercent(goal.progress_percent);
  const monthly = estimatedMonthlyContribution(goal);

  return (
    <GlassPanel glow={progress >= 100 ? "emerald" : progress >= 75 ? "cyan" : "none"} hudCorners className="p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/5">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">VAULT #{goal.id?.slice(0, 6)}</span>
            <h4 className="text-sm font-semibold text-text-primary mt-0.5">{goal.name}</h4>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {goal.goal_type && (
              <SpatialBadge variant="cyan">
                {t(`goalTypes.${goal.goal_type}`)}
              </SpatialBadge>
            )}
            {progress >= 100 ? (
              <SpatialBadge variant="emerald">{t("goalComplete")}</SpatialBadge>
            ) : progress >= 75 ? (
              <SpatialBadge variant="cyan">{t("goalAlmostThere")}</SpatialBadge>
            ) : null}
          </div>
        </div>

        <div className="my-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xl font-bold font-mono text-cyan-400">{formatCurrency(currentAmount)}</span>
            <span className="text-xs font-mono text-text-muted">{t("ofTarget", { amount: formatCurrency(targetAmount) })}</span>
          </div>

          <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-cyan-400 shadow-[0_0_10px_rgba(0,242,254,0.5)]"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5 space-y-1">
        <div className="flex items-center justify-between text-xs font-mono text-text-muted">
          <span>{t("percentComplete", { percent: progress.toFixed(0) })}</span>
          {goal.target_date && (
            <span>{t("targetOn", { date: new Date(`${goal.target_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) })}</span>
          )}
        </div>
        {monthly !== null && (
          <p className="text-[11px] font-mono text-cyan-300/80 pt-1">
            {t("estimatedContribution", { amount: formatCurrency(monthly) })}
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

export default function SavingsPage() {
  const t = useTranslations("savings");
  const tc = useTranslations("common");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", target_amount: "", current_amount: "0", target_date: "", goal_type: "personal" });
  const [error, setError] = useState("");

  const goals = useSavingsGoals();
  const createGoal = useCreateSavingsGoal();
  const mlCapacity = useMLSavingsCapacity();
  const forecast = useMLForecast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createGoal.mutateAsync({
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount || "0"),
        target_date: form.target_date || null,
        goal_type: form.goal_type,
      });
      setShowForm(false);
      setForm({ name: "", target_amount: "", current_amount: "0", target_date: "", goal_type: "personal" });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  const cap = mlCapacity.data as { lower?: number | string; upper?: number | string; disclaimer?: string; explanation?: Array<{ description: string }> } | undefined;

  const expenseForecast = forecast.data?.expense_forecast;
  const incomeForecast = forecast.data?.income_forecast;
  const projectedSurplus = incomeForecast && expenseForecast
    ? incomeForecast.predicted - expenseForecast.predicted
    : null;

  const totalCurrent = goals.data?.reduce((s, g) => s + toNumber(g.current_amount), 0) ?? 0;
  const totalTarget = goals.data?.reduce((s, g) => s + toNumber(g.target_amount), 0) ?? 0;
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="RESERVES & CAPITAL VAULT"
        title={t("title")}
        subtitle={t("subtitleSummary", { count: goals.data?.length ?? 0, amount: formatCurrency(totalCurrent) })}
        action={
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />{t("addGoal")}
          </Button>
        }
      />

      {/* 3D Liquid Vault Hero Header */}
      <GlassPanel glow="cyan" hudCorners className="p-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-2">
            <SpatialBadge variant="cyan" pulse>CAPITAL STORAGE</SpatialBadge>
            <h3 className="text-xl font-bold text-text-primary">Target Allocation Protocol</h3>
            <p className="text-xs text-text-muted max-w-md">
              Automated liquid reserves visualizer. Keep track of your emergency buffer, inventory cycles, and equipment upgrades.
            </p>
            <div className="flex items-center gap-4 pt-2 font-mono text-xs">
              <div>
                <span className="text-text-muted">Total Saved: </span>
                <span className="text-cyan-400 font-bold">{formatCurrency(totalCurrent)}</span>
              </div>
              <div>
                <span className="text-text-muted">Target: </span>
                <span className="text-text-primary font-bold">{formatCurrency(totalTarget)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <SavingsVault progress={overallProgress} size={180} />
          </div>
        </div>
      </GlassPanel>

      {/* Goal Creation Modal / Drawer */}
      {showForm && (
        <GlassPanel glow="cyan" hudCorners className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("addGoal")}</h3>
            <SpatialBadge variant="cyan">INITIALIZING VAULT</SpatialBadge>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-text-secondary">{t("goalName")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("goalNamePlaceholder")} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("targetAmount")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("currentAmount")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("targetDate")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("goalType")}</Label>
              <select className="flex h-10 w-full mt-1 rounded-xl border border-cyan-500/20 bg-surface-container px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-400" value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })}>
                {GOAL_TYPES.map((gt) => <option key={gt} value={gt}>{t(`goalTypes.${gt}`)}</option>)}
              </select>
            </div>
            <div className="flex gap-3 sm:col-span-2 pt-2">
              <Button type="submit" disabled={createGoal.isPending} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6">
                {createGoal.isPending ? "CREATING..." : tc("save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-text-secondary">
                {tc("cancel")}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-xs font-mono text-rose-400">{error}</p>}
        </GlassPanel>
      )}

      {/* ML Forecast & Capacity Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassPanel glow="cyan" className="p-5">
          <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>{t("mlCapacity")}</span>
            </h4>
            <SpatialBadge variant="cyan">AI MODEL</SpatialBadge>
          </div>
          {mlCapacity.isLoading ? <Skeleton className="h-12 w-48 rounded-xl" /> : cap ? (
            <div>
              <p className="text-2xl font-bold tracking-tight font-mono text-cyan-300">{formatCurrency(toNumber(cap.lower))} – {formatCurrency(toNumber(cap.upper))}</p>
              {cap.disclaimer && <p className="mt-2 text-xs text-text-muted font-mono">{cap.disclaimer}</p>}
              {cap.explanation?.slice(0, 1).map((e, i) => <p key={i} className="mt-1 text-xs text-text-muted">{e.description}</p>)}
            </div>
          ) : <p className="text-xs text-text-muted">{tc("noData")}</p>}
        </GlassPanel>

        {projectedSurplus !== null && (
          <GlassPanel glow={projectedSurplus >= 0 ? "emerald" : "rose"} className="p-5">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                <span>{t("forecastSurplus")}</span>
              </h4>
              <SpatialBadge variant={projectedSurplus >= 0 ? "emerald" : "rose"}>
                {projectedSurplus >= 0 ? "SURPLUS" : "DEFICIT"}
              </SpatialBadge>
            </div>
            <div>
              <p className={`text-2xl font-bold tracking-tight font-mono ${projectedSurplus >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(projectedSurplus)}
              </p>
              <p className="mt-1 text-xs text-text-muted font-mono">
                {projectedSurplus >= 0
                  ? t("surplusPositive", { amount: formatCurrency(projectedSurplus) })
                  : t("surplusNegative", { amount: formatCurrency(Math.abs(projectedSurplus)) })}
              </p>
            </div>
          </GlassPanel>
        )}
      </div>

      {/* Grid of Vaults */}
      <div className="grid gap-4 sm:grid-cols-2">
        {goals.isLoading ? (
          <>
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </>
        ) : goals.isError ? (
          <p className="text-xs font-mono text-rose-400 sm:col-span-2">{tc("error")}</p>
        ) : goals.data?.length ? (
          goals.data.map((g) => <SavingsGoalCard key={g.id} goal={g} />)
        ) : (
          <div className="sm:col-span-2">
            <EmptyState
              title={t("noGoalsTitle")}
              description={t("noGoalsDesc")}
              icon={PiggyBank}
              action={
                <Button size="sm" onClick={() => setShowForm(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />{t("addGoal")}
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
