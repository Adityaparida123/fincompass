"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { ResponsiveLineChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { useExpensesMonthly, useExpenseTrends, useMLForecast } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";

export default function CashflowPage() {
  const t = useTranslations("cashflow");
  const tc = useTranslations("common");
  const period = format(new Date(), "yyyy-MM");

  const monthly = useExpensesMonthly(period);
  const trends = useExpenseTrends(6);
  const forecast = useMLForecast();

  const income = parseFloat(monthly.data?.total_income ?? "0");
  const expenses = parseFloat(monthly.data?.total_expenses ?? "0");
  const net = parseFloat(monthly.data?.net_cash_flow ?? "0");

  const trendData = trends.data?.points?.map((p) => ({
    period: p.period,
    income: p.income ? parseFloat(p.income) : 0,
    expenses: parseFloat(p.total),
    net: (p.income ? parseFloat(p.income) : 0) - parseFloat(p.total),
  })) ?? [];

  const forecastData = (forecast.data as { forecasts?: Array<{ forecast_month: string; expected_cashflow: number; lower_range?: number; upper_range?: number }> })?.forecasts?.map((f) => ({
    period: f.forecast_month,
    expected: f.expected_cashflow,
    lower: f.lower_range ?? f.expected_cashflow,
    upper: f.upper_range ?? f.expected_cashflow,
  })) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("income"), value: income, loading: monthly.isLoading },
          { label: t("expenses"), value: expenses, loading: monthly.isLoading },
          { label: t("net"), value: net, loading: monthly.isLoading },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent>{s.loading ? <Skeleton className="h-8 w-28" /> : (
              <p className={`text-2xl font-bold ${s.label === t("net") && s.value < 0 ? "text-destructive" : ""}`}>{formatCurrency(s.value)}</p>
            )}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{t("trends")}</CardTitle></CardHeader>
        <CardContent>
          {trends.isLoading ? <ChartSkeleton /> : trends.isError ? (
            <PageError message={tc("error")} onRetry={() => trends.refetch()} />
          ) : trendData.length ? (
            <ResponsiveLineChart data={trendData} xKey="period" lines={[
              { key: "income", name: t("income"), color: "#0d9488" },
              { key: "expenses", name: t("expenses"), color: "#6366f1" },
              { key: "net", name: t("net"), color: "#f59e0b" },
            ]} />
          ) : <p className="text-sm text-muted-foreground">{tc("noData")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("forecast")}</CardTitle>
          <Badge variant="outline">{tc("forecastDisclaimer")}</Badge>
        </CardHeader>
        <CardContent>
          {forecast.isLoading ? <ChartSkeleton /> : forecast.isError ? (
            <PageError message={tc("error")} onRetry={() => forecast.refetch()} />
          ) : forecastData.length ? (
            <>
              <ResponsiveLineChart data={forecastData} xKey="period" lines={[
                { key: "expected", name: t("net"), color: "#0d9488" },
                { key: "lower", name: "Lower", color: "#94a3b8" },
                { key: "upper", name: "Upper", color: "#94a3b8" },
              ]} />
              {(forecast.data as { explanation?: Array<{ factor: string; description: string }> })?.explanation?.map((e, i) => (
                <p key={i} className="mt-2 text-sm text-muted-foreground">{e.description}</p>
              ))}
            </>
          ) : <p className="text-sm text-muted-foreground">{tc("noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
