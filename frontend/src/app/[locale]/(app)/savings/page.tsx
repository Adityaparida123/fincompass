"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Progress, Badge } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/common/shared";
import { useSavingsGoals, useCreateSavingsGoal, useMLSavingsCapacity, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber, clampPercent } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import type { SavingsGoal } from "@/types";
import { PiggyBank, Plus, TrendingUp } from "lucide-react";

function SavingsGoalCard({ goal }: { goal: SavingsGoal }) {
  const currentAmount = toNumber(goal.current_amount);
  const targetAmount = toNumber(goal.target_amount);
  const progress = clampPercent(goal.progress_percent);

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{goal.name}</CardTitle>
          {progress >= 100 ? (
            <Badge variant="success" className="text-[10px]">Complete</Badge>
          ) : progress >= 75 ? (
            <Badge variant="secondary" className="text-[10px]">Almost there</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(currentAmount)}</span>
          <span className="text-sm text-text-muted">of {formatCurrency(targetAmount)}</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {progress.toFixed(0)}% complete
          </p>
          {goal.target_date && (
            <p className="text-xs text-text-muted">Target: {goal.target_date}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SavingsPage() {
  const t = useTranslations("savings");
  const tc = useTranslations("common");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", target_amount: "", current_amount: "0", target_date: "" });
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
      });
      setShowForm(false);
      setForm({ name: "", target_amount: "", current_amount: "0", target_date: "" });
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={`${goals.data?.length ?? 0} goals · ${formatCurrency(totalCurrent)} saved`}
        action={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />{t("addGoal")}
          </Button>
        }
      />

      {showForm && (
        <Card><CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div><Label>{t("goalName")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Emergency Fund" required /></div>
            <div><Label>{t("targetAmount")}</Label><Input type="number" min="0" step="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required /></div>
            <div><Label>{t("currentAmount")}</Label><Input type="number" min="0" step="0.01" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} /></div>
            <div><Label>{t("targetDate")}</Label><Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></div>
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={createGoal.isPending}>{tc("save")}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>{tc("cancel")}</Button></div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("mlCapacity")}</CardTitle>
              <Badge variant="outline" className="text-[10px]">{tc("forecastDisclaimer")}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {mlCapacity.isLoading ? <Skeleton className="h-12 w-48" /> : cap ? (
              <div>
                <p className="text-2xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(toNumber(cap.lower))} – {formatCurrency(toNumber(cap.upper))}</p>
                {cap.disclaimer && <p className="mt-2 text-xs text-text-muted">{cap.disclaimer}</p>}
                {cap.explanation?.slice(0, 1).map((e, i) => <p key={i} className="mt-1 text-xs text-text-muted">{e.description}</p>)}
              </div>
            ) : <p className="text-sm text-text-muted">{tc("noData")}</p>}
          </CardContent>
        </Card>

        {projectedSurplus !== null && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("forecastSurplus")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)] ${projectedSurplus >= 0 ? "text-income" : "text-destructive"}`}>
                {formatCurrency(projectedSurplus)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {projectedSurplus >= 0
                  ? `You may be able to allocate approximately ${formatCurrency(projectedSurplus)} toward savings.`
                  : `Projected expenses exceed income by ${formatCurrency(Math.abs(projectedSurplus))}.`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {goals.isLoading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : goals.isError ? (
          <p className="text-sm text-destructive sm:col-span-2">{tc("error")}</p>
        ) : goals.data?.length ? (
          goals.data.map((g) => <SavingsGoalCard key={g.id} goal={g} />)
        ) : (
          <div className="sm:col-span-2">
            <EmptyState
              title="No savings goals yet"
              description="Set a savings goal to track your progress and build financial discipline."
              icon={PiggyBank}
              action={
                <Button size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Add goal
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
