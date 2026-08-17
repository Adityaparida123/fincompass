"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { ResponsiveLineChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { StatCard, PageHeader, EmptyState } from "@/components/common/shared";
import { useExpensesMonthly, useExpenseTrends, useMLForecast } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, Minus, ArrowRight } from "lucide-react";
import Link from "next/link";

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
    income: toNumber(p.income ?? 0),
    expenses: toNumber(p.total),
    net: toNumber(p.income ?? 0) - toNumber(p.total),
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
      <PageHeader title={t("title")} subtitle="Track your income, expenses, and projected cash flow." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("income")} value={formatCurrency(income)} icon={TrendingUp} loading={monthly.isLoading} subtitle="This month" />
        <StatCard label={t("expenses")} value={formatCurrency(expenses)} icon={TrendingDown} loading={monthly.isLoading} subtitle="This month" />
        <StatCard label={t("net")} value={formatCurrency(net)} icon={Wallet} loading={monthly.isLoading} subtitle={net >= 0 ? "Positive cash flow" : "Negative cash flow"} trend={net >= 0 ? "up" : "down"} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t("trends")}</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.isLoading ? <ChartSkeleton /> : trends.isError ? (
            <PageError message={tc("error")} onRetry={() => trends.refetch()} />
          ) : trendData.length ? (
            <ResponsiveLineChart data={trendData} xKey="period" valueFormatter={(v) => formatCurrency(v)} lines={[
              { key: "income", name: t("income"), color: "#14b8a6" },
              { key: "expenses", name: t("expenses"), color: "#818cf8" },
              { key: "net", name: t("net"), color: "#f59e0b" },
            ]} />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No trend data yet. Add transactions across multiple months to see trends.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium">{t("forecast")}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {forecastMethod === "rolling_baseline" && (
                <Badge variant="secondary" className="text-[10px]">{t("baselineMethod")}</Badge>
              )}
              {quality !== "none" && (
                <Badge variant={qualityInfo.variant} className="text-[10px]">{t("forecastQuality")}: {qualityInfo.label}</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">{tc("forecastDisclaimer")}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {forecast.isLoading ? (
            <ChartSkeleton />
          ) : forecast.isError ? (
            <PageError message={tc("error")} onRetry={() => forecast.refetch()} />
          ) : isNoTransactions ? (
            <EmptyState
              title={t("noTransactions")}
              description={t("noTransactionsDesc")}
              icon={Wallet}
            />
          ) : isInsufficientData ? (
            <div className="rounded-xl border border-dashed border-warning/30 bg-warning/5 p-6 text-center">
              <p className="text-sm font-medium">{t("insufficientData")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("insufficientDataDesc")}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("availableMonths", { count: forecast.data?.available_months ?? 0 })}
                {" · "}
                {t("requiredMonths", { count: forecast.data?.required_months ?? 3 })}
              </p>
            </div>
          ) : forecastData.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                {expenseForecast && (
                  <div className="rounded-xl border border-muted/50 bg-muted/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("expectedExpenses")}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(expenseForecast.predicted)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Range: {formatCurrency(expenseForecast.lower)} – {formatCurrency(expenseForecast.upper)}
                    </p>
                  </div>
                )}
                {incomeForecast && (
                  <div className="rounded-xl border border-muted/50 bg-muted/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("expectedIncome")}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(incomeForecast.predicted)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Range: {formatCurrency(incomeForecast.lower)} – {formatCurrency(incomeForecast.upper)}
                    </p>
                  </div>
                )}
                {expenseForecast && incomeForecast && (
                  <div className="rounded-xl border border-muted/50 bg-muted/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("expectedCashFlow")}</p>
                    <p className={`mt-1 text-2xl font-bold tracking-tight ${(incomeForecast.predicted - expenseForecast.predicted) < 0 ? "text-destructive" : "text-income"}`}>
                      {formatCurrency(incomeForecast.predicted - expenseForecast.predicted)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("expectedRange")}: {formatCurrency(Math.max(incomeForecast.lower - expenseForecast.upper, 0))} – {formatCurrency(incomeForecast.upper - expenseForecast.lower)}
                    </p>
                  </div>
                )}
              </div>

              <ResponsiveLineChart data={forecastData} xKey="period" valueFormatter={(v) => formatCurrency(v)} lines={[
                { key: "expected", name: t("net"), color: "#14b8a6" },
                { key: "lower", name: "Lower", color: "#94a3b8", dashed: true },
                { key: "upper", name: "Upper", color: "#94a3b8", dashed: true },
              ]} showArea />

              {categoryForecasts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{t("categoryForecasts")}</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryForecasts.map((cf) => (
                      <div key={cf.category} className="flex items-center justify-between rounded-lg border border-muted/50 px-3 py-2.5 transition-colors hover:bg-muted/20">
                        <div>
                          <span className="text-sm capitalize font-medium">{cf.category}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {t("monthsOfData", { count: cf.months_of_data })}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">{formatCurrency(cf.predicted)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {forecast.data?.explanation?.length ? (
                <div className="mt-4 rounded-lg bg-muted/20 px-4 py-3">
                  {forecast.data.explanation.map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-relaxed">{e.description}</p>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title={tc("noData")} description="No forecast data available." icon={Wallet} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
