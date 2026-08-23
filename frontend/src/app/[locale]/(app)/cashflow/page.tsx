"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/input";
import { CashFlowTrendChart, ForecastChart, ChartCard, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { StatCard, PageHeader, EmptyState } from "@/components/common/shared";
import { useExpensesMonthly, useExpenseTrends, useMLForecast, useDebts } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { classifyScope } from "@/lib/expense-scope";
import { TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";

const QUALITY_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" | "success" }> = {
  good: { label: "Good", variant: "success" },
  moderate: { label: "Moderate", variant: "secondary" },
  limited: { label: "Limited", variant: "outline" },
  none: { label: "N/A", variant: "outline" },
};

export default function CashflowPage() {
  const t = useTranslations("cashflow");
  const tc = useTranslations("common");
  const locale = useLocale();
  const period = format(new Date(), "yyyy-MM");

  const monthly = useExpensesMonthly(period);
  const trends = useExpenseTrends(6);
  const forecast = useMLForecast();
  const debts = useDebts();

  const income = toNumber(monthly.data?.total_income);
  const expenses = toNumber(monthly.data?.total_expenses);
  const net = toNumber(monthly.data?.net_cash_flow);

  const trendData = useMemo(() => trends.data?.points?.map((p) => ({
    period: p.period,
    income: toNumber(p.income ?? 0),
    expenses: toNumber(p.total),
    net: toNumber(p.income ?? 0) - toNumber(p.total),
  })) ?? [], [trends.data]);

  const forecastData = useMemo(() => forecast.data?.forecasts?.map((f) => ({
    period: f.forecast_month,
    expected: f.expected_cashflow,
    lower: f.lower_range ?? f.expected_cashflow,
    upper: f.upper_range ?? f.expected_cashflow,
    range: (f.upper_range ?? f.expected_cashflow) - (f.lower_range ?? f.expected_cashflow),
  })) ?? [], [forecast.data]);

  const isInsufficientData = forecast.data?.status === "insufficient_data";

  // ── Upcoming obligations (next 30 days) ─────────────────────────
  const monthlyPayments = (debts.data ?? []).reduce((s, d) => s + toNumber(d.monthly_payment), 0);
  const upcomingDebts = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return (debts.data ?? [])
      .filter((d) => !!d.due_date)
      .map((d) => {
        const due = new Date(`${d.due_date}T00:00:00`);
        const days = Math.round((due.getTime() - now.getTime()) / 86400000);
        return { debt: d, due, days };
      })
      .filter((d) => d.days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [debts.data]);
  const obligationsStrain = monthlyPayments > 0 && net < monthlyPayments;

  const isNoTransactions = forecast.data?.status === "insufficient_data" && (forecast.data?.available_months ?? 0) === 0;
  const forecastMethod = forecast.data?.method;
  const quality = forecast.data?.forecast_quality ?? "none";
  const qualityInfo = QUALITY_LABELS[quality] ?? QUALITY_LABELS.limited;

  const expenseForecast = forecast.data?.expense_forecast;
  const incomeForecast = forecast.data?.income_forecast;
  const categoryForecasts = forecast.data?.category_forecasts ?? [];

  const scopeSplit = Object.entries(monthly.data?.categories ?? {}).reduce(
    (acc, [name, val]) => {
      acc[classifyScope(name)] += toNumber(val);
      return acc;
    },
    { business: 0, personal: 0, mixed: 0 } as Record<"business" | "personal" | "mixed", number>,
  );
  const hasScopeData = scopeSplit.business + scopeSplit.personal + scopeSplit.mixed > 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("income")} value={formatCurrency(income)} icon={TrendingUp} loading={monthly.isLoading} subtitle={t("thisMonth")} />
        <StatCard label={t("expenses")} value={formatCurrency(expenses)} icon={TrendingDown} loading={monthly.isLoading} subtitle={t("thisMonth")} />
        <StatCard label={t("net")} value={formatCurrency(net)} icon={Wallet} loading={monthly.isLoading} subtitle={net >= 0 ? t("netPositive") : t("netNegative")} trend={net >= 0 ? "up" : "down"} />
      </div>

      {/* Upcoming obligations */}
      {upcomingDebts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("upcomingTitle")}</CardTitle>
              <Link href={`/${locale}/debt`} className="text-[11px] font-medium text-primary hover:underline">{t("manageDebts")}</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {obligationsStrain && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary" role="alert">
                <span className="font-medium text-warning">{t("obligationsWarningTitle")} </span>
                {t("obligationsWarning", { payments: formatCurrency(monthlyPayments), net: formatCurrency(net) })}
              </div>
            )}
            {upcomingDebts.map(({ debt, due, days }) => (
              <div key={debt.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-surface-container-low">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${days <= 7 ? "bg-destructive/10 text-destructive" : "bg-surface-container-high text-text-muted"}`}>
                    <Receipt className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{debt.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {days < 0 ? t("overdueBy", { days: Math.abs(days) })
                        : days === 0 ? t("dueToday")
                        : t("dueInDays", { count: days })} · {format(due, "d MMM")}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium font-[family-name:var(--font-jetbrains-mono)] text-text-primary">
                  {formatCurrency(toNumber(debt.monthly_payment))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasScopeData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("scopeSplit")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {([["business", scopeSplit.business, "text-primary"], ["personal", scopeSplit.personal, ""], ["mixed", scopeSplit.mixed, "text-warning"]] as const).map(([key, value, color]) => (
                <div key={key} className="rounded-xl border border-border bg-surface-container-low p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t(key)}</p>
                  <p className={`mt-1 text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] ${color}`}>{formatCurrency(value)}</p>
                  {expenses > 0 && (
                    <p className="mt-0.5 text-xs text-text-muted">{((value / expenses) * 100).toFixed(0)}% {t("ofExpenses")}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">{t("scopeSplitHint")}</p>
          </CardContent>
        </Card>
      )}

      <ChartCard title={t("trends")} subtitle={t("trendsSubtitle")}>
        {trends.isLoading ? <ChartSkeleton variant="area" /> : trends.isError ? (
          <PageError message={tc("error")} onRetry={() => trends.refetch()} />
        ) : trendData.length ? (
          <CashFlowTrendChart data={trendData} valueFormatter={(v) => formatCurrency(v)} />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-1 text-sm text-text-muted">
            <p className="font-medium">{t("noTrendData")}</p>
            <p className="text-xs">{t("noTrendDataDesc")}</p>
          </div>
        )}
      </ChartCard>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("forecast")}</CardTitle>
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
            <div className="rounded-xl border border-dashed border-warning/30 bg-warning/5 p-5 text-center">
              <p className="text-sm font-medium">{t("insufficientData")}</p>
              <p className="mt-1 text-xs text-text-muted">{t("insufficientDataDesc")}</p>
              <p className="mt-2 text-xs text-text-muted">
                {t("availableMonths", { count: forecast.data?.available_months ?? 0 })}
                {" · "}
                {t("requiredMonths", { count: forecast.data?.required_months ?? 3 })}
              </p>
            </div>
          ) : forecastData.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                {expenseForecast && (
                  <div className="rounded-xl border border-border bg-surface-container-low p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("expectedExpenses")}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(expenseForecast.predicted)}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {t("rangeLabel")}: {formatCurrency(expenseForecast.lower)} – {formatCurrency(expenseForecast.upper)}
                    </p>
                  </div>
                )}
                {incomeForecast && (
                  <div className="rounded-xl border border-border bg-surface-container-low p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("expectedIncome")}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(incomeForecast.predicted)}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {t("rangeLabel")}: {formatCurrency(incomeForecast.lower)} – {formatCurrency(incomeForecast.upper)}
                    </p>
                  </div>
                )}
                {expenseForecast && incomeForecast && (
                  <div className="rounded-xl border border-border bg-surface-container-low p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("expectedCashFlow")}</p>
                    <p className={`mt-1 text-2xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)] ${(incomeForecast.predicted - expenseForecast.predicted) < 0 ? "text-destructive" : "text-income"}`}>
                      {formatCurrency(incomeForecast.predicted - expenseForecast.predicted)}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {t("expectedRange")}: {formatCurrency(Math.max(incomeForecast.lower - expenseForecast.upper, 0))} – {formatCurrency(incomeForecast.upper - expenseForecast.lower)}
                    </p>
                  </div>
                )}
              </div>

              <ForecastChart data={forecastData} valueFormatter={(v) => formatCurrency(v)} />

              {categoryForecasts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-3">{t("categoryForecasts")}</h3>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryForecasts.map((cf) => (
                      <div key={cf.category} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-surface-container">
                        <div>
                          <span className="text-sm capitalize font-medium">{cf.category}</span>
                          <span className="ml-2 text-[10px] text-text-muted">
                            {t("monthsOfData", { count: cf.months_of_data })}
                          </span>
                        </div>
                        <span className="text-sm font-semibold font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(cf.predicted)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {forecast.data?.explanation?.length ? (
                <div className="mt-4 rounded-lg bg-surface-container/20 px-4 py-3">
                  {forecast.data.explanation.map((e, i) => (
                    <p key={i} className="text-xs text-text-muted leading-relaxed">{e.description}</p>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title={tc("noData")} description={t("noForecast")} icon={Wallet} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
