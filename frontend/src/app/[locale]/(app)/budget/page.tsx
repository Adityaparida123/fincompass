"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge } from "@/components/ui/input";
import { useBudgetStatus, useCreateBudget, useDeleteBudget, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";

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

  const getForecastForCategory = (category: string) =>
    categoryForecasts.find((cf) => cf.category === category);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <Button onClick={() => setShowForm(!showForm)}>{t("addBudget")}</Button>
      </div>

      {showForm && (
        <Card><CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div><Label>{t("category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></div>
            <div><Label>{t("limit")}</Label><Input type="number" min="0" step="0.01" value={form.limit_amount} onChange={(e) => setForm({ ...form, limit_amount: e.target.value })} required /></div>
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={createBudget.isPending}>{tc("save")}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>{tc("cancel")}</Button></div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle>{period}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {budget.isLoading ? <Skeleton className="h-40 w-full" /> : budget.isError ? (
            <p className="text-sm text-destructive">{t("error")}</p>
          ) : budget.data?.length ? budget.data.map((b) => {
            const pctUsed = toNumber(b.percent_used);
            const over = pctUsed > 100;
            const catForecast = getForecastForCategory(b.category);
            const limit = toNumber(b.limit_amount);
            const forecastDiff = catForecast ? catForecast.predicted - limit : null;

            return (
              <div key={b.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="capitalize font-medium">{b.category}</span>
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency(toNumber(b.spent))} / {formatCurrency(limit)}</span>
                    {over && <Badge variant="destructive">{t("overBudget")}</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm(t("confirmDelete"))) {
                          deleteBudget.mutate(b.id);
                        }
                      }}
                    >
                      {tc("delete")}
                    </Button>
                  </div>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, pctUsed)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{pctUsed.toFixed(1)}% used · {formatCurrency(toNumber(b.remaining))} remaining</p>
                {forecastDiff !== null && (
                  <p className={`mt-1 text-xs ${forecastDiff > 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {forecastDiff > 0
                      ? t("forecastAboveBudget", { amount: formatCurrency(forecastDiff), category: b.category })
                      : t("forecastBelowBudget", { amount: formatCurrency(Math.abs(forecastDiff)), category: b.category })}
                  </p>
                )}
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">{t("noBudgets")}</p>}
          {!budget.isLoading && !hasForecastData && budget.data?.length ? (
            <p className="text-xs text-muted-foreground mt-2">{t("noForecastData")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
