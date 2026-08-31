"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { CashFlowTrendChart, CombinedTrendForecastChart, ChartCard, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { EmptyState } from "@/components/common/shared";
import { useExpensesMonthly, useExpenseTrends, useMLForecast, useDebts } from "@/hooks/use-api";
import { useChatStore } from "@/stores/chat-store";
import { formatCurrency, toNumber } from "@/lib/utils";
import { classifyScope } from "@/lib/expense-scope";
import { TrendingUp, TrendingDown, Wallet, Receipt, Sparkles, Activity, AlertCircle } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialMetric } from "@/components/spatial/spatial-metric";
import { SpatialBadge } from "@/components/spatial/spatial-badge";
import { CashFlowStream } from "@/components/3d/cash-flow-stream";

const QUALITY_LABELS: Record<string, { label: string; variant: "emerald" | "cyan" | "amber" | "rose" }> = {
  good: { label: "High Confidence", variant: "emerald" },
  moderate: { label: "Moderate", variant: "cyan" },
  limited: { label: "Limited", variant: "amber" },
  none: { label: "Calibrating", variant: "amber" },
};

export default function CashflowPage() {
  const t = useTranslations("cashflow");
  const tc = useTranslations("common");
  const locale = useLocale();
  const period = format(new Date(), "yyyy-MM");
  const { setOpen: setChatOpen, setDraft: setChatDraft } = useChatStore();

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
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="LIQUIDITY MATRIX"
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant="cyan" pulse>LIVE LIQUIDITY</SpatialBadge>
            <SpatialBadge variant={qualityInfo.variant}>{qualityInfo.label}</SpatialBadge>
          </div>
        }
      />

      {/* 3D Flow Visualizer + High Level Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-4">
          <GlassPanel glow="cyan" hudCorners className="p-5 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-between w-full pb-2 border-b border-white/5 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Stream Dynamics</span>
              <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            </div>
            <CashFlowStream income={income} expense={expenses} size={190} />
            <div className="flex items-center justify-between w-full pt-3 mt-1 border-t border-white/5 text-[11px] font-mono">
              <span className="text-emerald-400">INFLOW: {formatCurrency(income)}</span>
              <span className="text-rose-400">OUTFLOW: {formatCurrency(expenses)}</span>
            </div>
          </GlassPanel>
        </div>

        <div className="lg:col-span-8 grid gap-4 sm:grid-cols-3">
          <SpatialMetric
            label={t("income")}
            value={formatCurrency(income)}
            subtitle={t("thisMonth")}
            glow="emerald"
            icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
          />
          <SpatialMetric
            label={t("expenses")}
            value={formatCurrency(expenses)}
            subtitle={t("thisMonth")}
            glow="rose"
            icon={<TrendingDown className="h-4 w-4 text-rose-400" />}
          />
          <SpatialMetric
            label={t("net")}
            value={formatCurrency(net)}
            subtitle={net >= 0 ? t("netPositive") : t("netNegative")}
            trend={net >= 0 ? "up" : "down"}
            glow={net >= 0 ? "cyan" : "rose"}
            icon={<Wallet className="h-4 w-4 text-cyan-400" />}
          />
        </div>
      </div>

      {/* Upcoming Obligations */}
      {upcomingDebts.length > 0 && (
        <GlassPanel glow={obligationsStrain ? "amber" : "none"} hudCorners className="p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-white/5 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-cyan-400" />
              <span>{t("upcomingTitle")}</span>
            </h3>
            <Link href={`/${locale}/debt`} className="text-xs font-mono font-medium text-cyan-300 hover:text-cyan-200 transition-colors">
              {t("manageDebts")} &rarr;
            </Link>
          </div>

          <div className="space-y-2.5">
            {obligationsStrain && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200 flex items-center gap-2.5" role="alert">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-semibold text-amber-300">{t("obligationsWarningTitle")} </span>
                  {t("obligationsWarning", { payments: formatCurrency(monthlyPayments), net: formatCurrency(net) })}
                </div>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {upcomingDebts.map(({ debt, due, days }) => (
                <div key={debt.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-surface-container/60 px-4 py-3 transition-colors hover:bg-surface-container">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${days <= 7 ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"}`}>
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-primary">{debt.name}</p>
                      <p className="text-[11px] font-mono text-text-muted">
                        {days < 0 ? t("overdueBy", { days: Math.abs(days) })
                          : days === 0 ? t("dueToday")
                          : t("dueInDays", { count: days })} · {format(due, "d MMM")}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-mono font-bold text-text-primary">
                    {formatCurrency(toNumber(debt.monthly_payment))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Scope Split Matrix */}
      {hasScopeData && (
        <GlassPanel className="p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary pb-3 border-b border-white/5 mb-4">{t("scopeSplit")}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {([["business", scopeSplit.business, "text-cyan-400", "cyan"], ["personal", scopeSplit.personal, "text-text-primary", "none"], ["mixed", scopeSplit.mixed, "text-amber-400", "amber"]] as const).map(([key, value, color, glow]) => (
              <GlassPanel key={key} glow={glow as any} className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{t(key)}</p>
                <p className={`mt-1 text-xl font-bold font-mono ${color}`}>{formatCurrency(value)}</p>
                {expenses > 0 && (
                  <p className="mt-0.5 text-xs font-mono text-text-muted">{((value / expenses) * 100).toFixed(0)}% {t("ofExpenses")}</p>
                )}
              </GlassPanel>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-muted font-mono">{t("scopeSplitHint")}</p>
        </GlassPanel>
      )}

      {/* Historical Trend Chart */}
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

      {/* AI Machine Learning Forecast */}
      <GlassPanel glow="cyan" hudCorners className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-white/5 mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>{t("forecast")}</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {forecastMethod === "rolling_baseline" && (
              <SpatialBadge variant="cyan">{t("baselineMethod")}</SpatialBadge>
            )}
            {quality !== "none" && (
              <SpatialBadge variant={qualityInfo.variant}>{t("forecastQuality")}: {qualityInfo.label}</SpatialBadge>
            )}
            {!isNoTransactions && !isInsufficientData && forecastData.length > 0 && !forecast.isLoading && (
              <button
                type="button"
                onClick={() => {
                  const f = forecastData[0]!;
                  const last = forecastData[forecastData.length - 1]!;
                  setChatDraft(
                    t("forecastDraft", {
                      net: formatCurrency(f.expected),
                      low: formatCurrency(f.lower),
                      high: formatCurrency(f.upper),
                      until: String(last.period ?? ""),
                      quality: qualityInfo.label,
                    }),
                  );
                  setChatOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-mono font-medium text-cyan-300 hover:bg-cyan-500/20 transition-all"
              >
                <Sparkles className="h-3 w-3 text-cyan-400" />
                <span>{t("forecastExplain")}</span>
              </button>
            )}
          </div>
        </div>

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
          <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-center">
            <p className="text-sm font-semibold text-text-primary">{t("insufficientData")}</p>
            <p className="mt-1 text-xs text-text-muted">{t("insufficientDataDesc")}</p>
            <p className="mt-2 text-xs font-mono text-cyan-300">
              {t("availableMonths", { count: forecast.data?.available_months ?? 0 })}
              {" · "}
              {t("requiredMonths", { count: forecast.data?.required_months ?? 3 })}
            </p>
          </div>
        ) : forecastData.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              {expenseForecast && (
                <GlassPanel className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{t("expectedExpenses")}</p>
                  <p className="mt-1 text-xl font-bold font-mono text-rose-400">{formatCurrency(expenseForecast.predicted)}</p>
                  <p className="mt-1 text-xs font-mono text-text-muted">
                    {t("rangeLabel")}: {formatCurrency(expenseForecast.lower)} – {formatCurrency(expenseForecast.upper)}
                  </p>
                </GlassPanel>
              )}
              {incomeForecast && (
                <GlassPanel className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{t("expectedIncome")}</p>
                  <p className="mt-1 text-xl font-bold font-mono text-emerald-400">{formatCurrency(incomeForecast.predicted)}</p>
                  <p className="mt-1 text-xs font-mono text-text-muted">
                    {t("rangeLabel")}: {formatCurrency(incomeForecast.lower)} – {formatCurrency(incomeForecast.upper)}
                  </p>
                </GlassPanel>
              )}
              {expenseForecast && incomeForecast && (
                <GlassPanel className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{t("expectedCashFlow")}</p>
                  <p className={`mt-1 text-xl font-bold font-mono ${(incomeForecast.predicted - expenseForecast.predicted) < 0 ? "text-rose-400" : "text-cyan-400"}`}>
                    {formatCurrency(incomeForecast.predicted - expenseForecast.predicted)}
                  </p>
                  <p className="mt-1 text-xs font-mono text-text-muted">
                    {t("expectedRange")}: {formatCurrency(Math.max(incomeForecast.lower - expenseForecast.upper, 0))} – {formatCurrency(incomeForecast.upper - expenseForecast.lower)}
                  </p>
                </GlassPanel>
              )}
            </div>

            <CombinedTrendForecastChart
              historical={trendData}
              forecast={forecastData}
              valueFormatter={(v) => formatCurrency(v)}
            />

            <p className="mt-2 text-[10px] font-mono text-text-muted">{t("combinedChartNote")}</p>

            {categoryForecasts.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">{t("categoryForecasts")}</h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryForecasts.map((cf) => (
                    <div key={cf.category} className="flex items-center justify-between rounded-xl border border-white/5 bg-surface-container/60 px-4 py-2.5 transition-colors hover:bg-surface-container">
                      <div>
                        <span className="text-xs capitalize font-semibold text-text-primary">{cf.category}</span>
                        <span className="ml-2 text-[10px] font-mono text-text-muted">
                          {t("monthsOfData", { count: cf.months_of_data })}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-300">{formatCurrency(cf.predicted)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {forecast.data?.explanation?.length ? (
              <div className="mt-4 rounded-xl border border-white/5 bg-surface-container/40 p-4">
                {forecast.data.explanation.map((e, i) => (
                  <p key={i} className="text-xs text-text-muted leading-relaxed font-mono">{e.description}</p>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState title={tc("noData")} description={t("noForecast")} icon={Wallet} />
        )}
      </GlassPanel>
    </div>
  );
}
