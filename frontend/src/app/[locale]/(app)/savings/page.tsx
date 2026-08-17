"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Progress, Badge } from "@/components/ui/input";
import { useSavingsGoals, useCreateSavingsGoal, useMLSavingsCapacity, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber, clampPercent } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import type { SavingsGoal } from "@/types";

function SavingsGoalCard({ goal }: { goal: SavingsGoal }) {
  const currentAmount = toNumber(goal.current_amount);
  const targetAmount = toNumber(goal.target_amount);
  const progress = clampPercent(goal.progress_percent);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{goal.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{formatCurrency(currentAmount)}</span>
          <span className="text-muted-foreground">{formatCurrency(targetAmount)}</span>
        </div>
        <Progress value={progress} />
        <p className="text-xs text-muted-foreground">
          {progress.toFixed(0)}% · {goal.status}{goal.target_date ? ` · ${goal.target_date}` : ""}
        </p>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <Button onClick={() => setShowForm(!showForm)}>{t("addGoal")}</Button>
      </div>

      {showForm && (
        <Card><CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div><Label>{t("goalName")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>{t("targetAmount")}</Label><Input type="number" min="0" step="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required /></div>
            <div><Label>{t("currentAmount")}</Label><Input type="number" min="0" step="0.01" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} /></div>
            <div><Label>{t("targetDate")}</Label><Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></div>
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={createGoal.isPending}>{tc("save")}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>{tc("cancel")}</Button></div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("mlCapacity")}</CardTitle>
          <Badge variant="outline">{tc("forecastDisclaimer")}</Badge>
        </CardHeader>
        <CardContent>
          {mlCapacity.isLoading ? <Skeleton className="h-12 w-48" /> : cap ? (
            <>
              <p className="text-2xl font-bold">{formatCurrency(toNumber(cap.lower))} – {formatCurrency(toNumber(cap.upper))}</p>
              {cap.disclaimer && <p className="mt-2 text-sm text-muted-foreground">{cap.disclaimer}</p>}
              {cap.explanation?.map((e, i) => <p key={i} className="mt-1 text-sm text-muted-foreground">{e.description}</p>)}
            </>
          ) : <p className="text-sm text-muted-foreground">{tc("noData")}</p>}
        </CardContent>
      </Card>

      {projectedSurplus !== null && projectedSurplus > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("forecastSurplus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(projectedSurplus)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("forecastSurplusDesc", { amount: formatCurrency(projectedSurplus) })}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {goals.isLoading ? (
          <Skeleton className="h-32 w-full sm:col-span-2" />
        ) : goals.isError ? (
          <p className="text-sm text-destructive sm:col-span-2">{tc("error")}</p>
        ) : goals.data?.length ? (
          goals.data.map((g) => <SavingsGoalCard key={g.id} goal={g} />)
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">{t("noGoals")}</p>
        )}
      </div>
    </div>
  );
}
