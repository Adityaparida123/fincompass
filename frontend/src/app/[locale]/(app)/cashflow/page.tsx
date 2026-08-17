"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { ResponsiveLineChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { useExpensesMonthly, useExpenseTrends, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";

export default function CashflowPage() {
  const t = useTranslations("cashflow");
  const tc = useTranslations("common");
  const period = format(new Date(), "yyyy-MM");

  const monthly = useExpensesMonthly(period);
  const trends = useExpenseTrends(6);
  const forecast = useMLForecast();

  const income = toNumber(monthly.data?.total_income);
  const expenses = toNumber(monthly.data?.total_expenses);
  const net = toNumber(monthly.data?.net_cash_flow);

  const trendData = trends.data?.points?.map((p) => ({
    period: p.period,
    income: toNumber(p.income),
    expenses: toNumber(p.total),
    net: toNumber(p.income) - toNumber(p.total),
  })) ?? [];

  const forecastData = forecast.data?.forecasts?.map((f) => ({
    period: f.forecast_month,
    expected: f.expected_cashflow,
    lower: f.lower_range ?? f.expected_cashflow,
    upper: f.upper_range ?? f.expected_cashflow,
  })) ?? [];

  const isInsufficientData = forecast.data?.status === "insufficient_data";
  const forecastMethod = forecast.data?.method;

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
          <div className="flex items-center gap-2">
            {forecastMethod === "rolling_baseline" && (
              <Badge variant="secondary">{t("baselineMethod")}</Badge>
            )}
            <Badge variant="outline">{tc("forecastDisclaimer")}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {forecast.isLoading ? (
            <ChartSkeleton />
          ) : forecast.isError ? (
            <PageError message={tc("error")} onRetry={() => forecast.refetch()} />
          ) : isInsufficientData ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("insufficientData")}</p>
              <p className="text-xs text-muted-foreground">
                {t("availableMonths", { count: forecast.data?.available_months ?? 0 })}
                {" · "}
                {t("requiredMonths", { count: forecast.data?.required_months ?? 3 })}
              </p>
            </div>
          ) : forecastData.length ? (
            <>
              <ResponsiveLineChart data={forecastData} xKey="period" lines={[
                { key: "expected", name: t("net"), color: "#0d9488" },
                { key: "lower", name: "Lower", color: "#94a3b8" },
                { key: "upper", name: "Upper", color: "#94a3b8" },
              ]} />
              {forecast.data?.explanation?.map((e, i) => (
                <p key={i} className="mt-2 text-sm text-muted-foreground">{e.description}</p>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{tc("noData")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
