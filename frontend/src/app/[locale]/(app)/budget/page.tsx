"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/common/shared";
import { useBudgetStatus, useCreateBudget, useDeleteBudget, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import { Plus, Target, AlertTriangle } from "lucide-react";

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

  const totalBudget = budget.data?.reduce((s, b) => s + toNumber(b.limit_amount), 0) ?? 0;
  const totalSpent = budget.data?.reduce((s, b) => s + toNumber(b.spent), 0) ?? 0;
  const totalRemaining = budget.data?.reduce((s, b) => s + toNumber(b.remaining), 0) ?? 0;
  const overBudgetCount = budget.data?.filter((b) => toNumber(b.percent_used) > 100).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={period}
        action={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />{t("addBudget")}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div><Label>{t("category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g., food, transport, housing" required /></div>
              <div><Label>{t("limit")}</Label><Input type="number" min="0" step="0.01" value={form.limit_amount} onChange={(e) => setForm({ ...form, limit_amount: e.target.value })} required /></div>
              <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={createBudget.isPending}>{tc("save")}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>{tc("cancel")}</Button></div>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {budget.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Budget</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(totalBudget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Spent</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Remaining</p>
              <p className={`mt-1 text-2xl font-bold ${totalRemaining < 0 ? "text-destructive" : "text-income"}`}>{formatCurrency(totalRemaining)}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
            {overBudgetCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="mr-1 h-3 w-3" />{overBudgetCount} over budget
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {budget.isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : budget.isError ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-destructive">{t("error")}</p>
            </div>
          ) : budget.data?.length ? budget.data.map((b) => {
            const pctUsed = toNumber(b.percent_used);
            const over = pctUsed > 100;
            const nearing = pctUsed > 80 && !over;
            const catForecast = getForecastForCategory(b.category);
            const limit = toNumber(b.limit_amount);
            const forecastDiff = catForecast ? catForecast.predicted - limit : null;

            return (
              <div key={b.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="capitalize font-medium text-sm">{b.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatCurrency(toNumber(b.spent))} / {formatCurrency(limit)}</span>
                    {over && <Badge variant="destructive" className="text-[10px]">Over budget</Badge>}
                    {nearing && <Badge variant="secondary" className="text-[10px]">Nearing limit</Badge>}
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t("confirmDelete"))) deleteBudget.mutate(b.id); }}>
                      {tc("delete")}
                    </Button>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${over ? "bg-destructive" : nearing ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, pctUsed)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{pctUsed.toFixed(1)}% used · {formatCurrency(toNumber(b.remaining))} remaining</p>
                  {forecastDiff !== null && (
                    <p className={`text-xs font-medium ${forecastDiff > 0 ? "text-destructive" : "text-income"}`}>
                      {forecastDiff > 0
                        ? `Forecast ${formatCurrency(forecastDiff)} over`
                        : `Forecast ${formatCurrency(Math.abs(forecastDiff))} under`}
                    </p>
                  )}
                </div>
              </div>
            );
          }) : (
            <EmptyState
              title="No budgets set yet"
              description="Create a monthly budget to track spending and receive alerts when you're approaching a category limit."
              icon={Target}
              action={
                <Button size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Create Budget
                </Button>
              }
            />
          )}
          {!budget.isLoading && !hasForecastData && budget.data?.length ? (
            <p className="text-xs text-muted-foreground text-center pt-2">{t("noForecastData")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
