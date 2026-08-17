"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/input";
import { ResponsiveBarChart, ResponsiveLineChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import {
  useExpensesMonthly, useExpenseTrends, useReadiness,
  useRecommendations, useNotifications, useBudgetStatus, useSavingsGoals,
  useMLPatterns, useMLForecast,
} from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const period = format(new Date(), "yyyy-MM");

  const monthly = useExpensesMonthly(period);
  const trends = useExpenseTrends(6);
  const readiness = useReadiness();
  const recommendations = useRecommendations();
  const notifications = useNotifications(true);
  const budget = useBudgetStatus(period);
  const savings = useSavingsGoals();
  const patterns = useMLPatterns();
  const forecast = useMLForecast();

  const netCashFlow = monthly.data ? toNumber(monthly.data.net_cash_flow) : 0;
  const totalExpenses = monthly.data ? toNumber(monthly.data.total_expenses) : 0;
  const totalSavings = savings.data?.reduce((s, g) => s + toNumber(g.current_amount), 0) ?? 0;
  const score = readiness.data?.score ?? 0;

  const trendData = trends.data?.points?.map((p) => ({
    period: p.period,
    expenses: toNumber(p.total),
    income: toNumber(p.income),
  })) ?? [];

  const forecastData = forecast.data?.forecasts?.map((f) => ({
    period: f.forecast_month,
    expected: f.expected_cashflow,
  })) ?? [];
  const isInsufficientData = forecast.data?.status === "insufficient_data";

  const stats = [
    { label: t("cashFlow"), value: formatCurrency(netCashFlow), loading: monthly.isLoading },
    { label: t("savings"), value: formatCurrency(totalSavings), loading: savings.isLoading },
    { label: t("expenses"), value: formatCurrency(totalExpenses), loading: monthly.isLoading },
    { label: t("readiness"), value: `${score}/100`, loading: readiness.isLoading },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("greeting")} 👋</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {s.loading ? <Skeleton className="h-8 w-24" /> : (
                <p className="text-2xl font-bold">{s.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("incomeVsExpenses")}</CardTitle></CardHeader>
          <CardContent>
            {trends.isLoading ? <ChartSkeleton /> : trends.isError ? (
              <PageError message="Unable to load chart data." onRetry={() => trends.refetch()} />
            ) : (
              <ResponsiveBarChart data={trendData} xKey="period" valueFormatter={(v) => formatCurrency(v)} bars={[
                { key: "income", name: "Income", color: "#0d9488" },
                { key: "expenses", name: "Expenses", color: "#6366f1" },
              ]} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("budgetStatus")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {budget.isLoading ? <Skeleton className="h-32 w-full" /> : budget.isError ? (
              <p className="text-sm text-destructive">{t("budgetError")}</p>
            ) : budget.data?.length ? (
              budget.data.slice(0, 5).map((b) => {
                const pctUsed = toNumber(b.percent_used);
                const over = pctUsed > 100;
                return (
                <div key={b.id}>
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{b.category}</span>
                    <span>{formatCurrency(toNumber(b.spent))} / {formatCurrency(toNumber(b.limit_amount))}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, pctUsed)}%` }}
                    />
                  </div>
                </div>
              )})
            ) : <p className="text-sm text-muted-foreground">{t("noBudgets")}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t("insights")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {patterns.isLoading ? <Skeleton className="h-20 w-full" /> : (patterns.data as { patterns?: Array<{ pattern: string; description: string }> } | undefined)?.patterns?.length ? (
              (patterns.data as { patterns: Array<{ pattern: string; description: string }> }).patterns.slice(0, 4).map((p, i) => (
                <p key={i} className="text-sm text-muted-foreground">{p.description}</p>
              ))
            ) : monthly.data?.insights?.map((ins, i) => (
              <p key={i} className="text-sm text-muted-foreground">{ins}</p>
            )) ?? <p className="text-sm text-muted-foreground">No insights yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("forecast")}</CardTitle></CardHeader>
          <CardContent>
            {forecast.isLoading ? <Skeleton className="h-20 w-full" /> : forecast.isError ? (
              <p className="text-sm text-destructive">{t("forecastError")}</p>
            ) : isInsufficientData ? (
              <div className="space-y-1">
                {(forecast.data?.available_months ?? 0) === 0 ? (
                  <>
                    <p className="text-sm font-medium">{t("forecastNoTransactions")}</p>
                    <p className="text-xs text-muted-foreground">{t("forecastNoTransactionsDesc")}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">{t("forecastInsufficient")}</p>
                    <p className="text-xs text-muted-foreground">{t("forecastInsufficientDesc")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("forecastAvailable", { count: forecast.data?.available_months ?? 0 })}
                      {" · "}
                      {t("forecastRequired", { count: forecast.data?.required_months ?? 3 })}
                    </p>
                  </>
                )}
              </div>
            ) : forecast.data?.expense_forecast || forecast.data?.income_forecast ? (
              <div className="space-y-3">
                {forecast.data.expense_forecast && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("expectedExpenses")}</span>
                    <span className="font-medium">{formatCurrency(forecast.data.expense_forecast.predicted)}</span>
                  </div>
                )}
                {forecast.data.income_forecast && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("expectedIncome")}</span>
                    <span className="font-medium">{formatCurrency(forecast.data.income_forecast.predicted)}</span>
                  </div>
                )}
                {forecast.data.expense_forecast && forecast.data.income_forecast && (
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">{t("expectedSurplus")}</span>
                    <span className={`font-medium ${(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted) < 0 ? "text-destructive" : ""}`}>
                      {formatCurrency(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted)}
                    </span>
                  </div>
                )}
                {forecast.data.explanation?.slice(0, 2).map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{e.description}</p>
                ))}
                <Link href="/cashflow" className="text-xs text-primary hover:underline">{t("viewForecast")}</Link>
              </div>
            ) : forecastData.length ? (
              <div className="space-y-2">
                {forecast.data?.forecasts?.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{f.forecast_month}</span>
                    <span className="font-medium">{formatCurrency(f.expected_cashflow)}</span>
                  </div>
                ))}
                {forecast.data?.explanation?.slice(0, 2).map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{e.description}</p>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{tc("noData")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recommendations.isLoading ? <Skeleton className="h-20 w-full" /> : recommendations.data?.recommendations?.slice(0, 3).map((r, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="font-medium text-sm">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
              </div>
            )) ?? <p className="text-sm text-muted-foreground">No recommendations yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
