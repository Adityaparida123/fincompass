"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { ResponsiveLineChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { useExpensesMonthly, useExpenseTrends, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";

const QUALITY_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" }> = {
  good: { label: "Good", variant: "success" },
  moderate: { label: "Moderate", variant: "secondary" },
  limited: { label: "Limited", variant: "outline" },
  none: { label: "N/A", variant: "outline" },
};

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
  const isNoTransactions = forecast.data?.status === "insufficient_data" && (forecast.data?.available_months ?? 0) === 0;
  const forecastMethod = forecast.data?.method;
  const quality = forecast.data?.forecast_quality ?? "none";
  const qualityInfo = QUALITY_LABELS[quality] ?? QUALITY_LABELS.limited;

  const expenseForecast = forecast.data?.expense_forecast;
  const incomeForecast = forecast.data?.income_forecast;
  const categoryForecasts = forecast.data?.category_forecasts ?? [];

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
            {quality !== "none" && (
              <Badge variant={qualityInfo.variant}>{t("forecastQuality")}: {qualityInfo.label}</Badge>
            )}
            <Badge variant="outline">{tc("forecastDisclaimer")}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {forecast.isLoading ? (
            <ChartSkeleton />
          ) : forecast.isError ? (
            <PageError message={tc("error")} onRetry={() => forecast.refetch()} />
          ) : isNoTransactions ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("noTransactions")}</p>
              <p className="text-xs text-muted-foreground">{t("noTransactionsDesc")}</p>
            </div>
          ) : isInsufficientData ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("insufficientData")}</p>
              <p className="text-xs text-muted-foreground">{t("insufficientDataDesc")}</p>
              <p className="text-xs text-muted-foreground">
                {t("availableMonths", { count: forecast.data?.available_months ?? 0 })}
                {" · "}
                {t("requiredMonths", { count: forecast.data?.required_months ?? 3 })}
              </p>
            </div>
          ) : forecastData.length ? (
            <>
              {/* 3-Layer Forecast: Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                {expenseForecast && (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">{t("expectedExpenses")}</p>
                    <p className="text-2xl font-bold">{formatCurrency(expenseForecast.predicted)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(expenseForecast.lower)} – {formatCurrency(expenseForecast.upper)}
                    </p>
                  </div>
                )}
                {incomeForecast && (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">{t("expectedIncome")}</p>
                    <p className="text-2xl font-bold">{formatCurrency(incomeForecast.predicted)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(incomeForecast.lower)} – {formatCurrency(incomeForecast.upper)}
                    </p>
                  </div>
                )}
                {expenseForecast && incomeForecast && (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">{t("expectedCashFlow")}</p>
                    <p className={`text-2xl font-bold ${(incomeForecast.predicted - expenseForecast.predicted) < 0 ? "text-destructive" : ""}`}>
                      {formatCurrency(incomeForecast.predicted - expenseForecast.predicted)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("expectedRange")}: {formatCurrency(
                        Math.max(incomeForecast.lower - expenseForecast.upper, 0)
                      )} – {formatCurrency(incomeForecast.upper - expenseForecast.lower)}
                    </p>
                  </div>
                )}
              </div>

              {/* Net cash flow chart */}
              <ResponsiveLineChart data={forecastData} xKey="period" lines={[
                { key: "expected", name: t("net"), color: "#0d9488" },
                { key: "lower", name: "Lower", color: "#94a3b8" },
                { key: "upper", name: "Upper", color: "#94a3b8" },
              ]} />

              {/* Category forecasts */}
              {categoryForecasts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-3">{t("categoryForecasts")}</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryForecasts.map((cf) => (
                      <div key={cf.category} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div>
                          <span className="text-sm capitalize">{cf.category}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({t("monthsOfData", { count: cf.months_of_data })})
                          </span>
                        </div>
                        <span className="text-sm font-medium">{formatCurrency(cf.predicted)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanations */}
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
