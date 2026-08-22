"use client";

import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { FinancialTrendChart, ChartCard, BudgetProgressList, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import {
  useExpensesMonthly, useExpenseTrends, useReadiness,
  useRecommendations, useBudgetStatus, useSavingsGoals,
  useMLPatterns, useMLForecast, useDebts,
} from "@/hooks/use-api";
import { formatCurrency, toNumber, formatPercent } from "@/lib/utils";
import { getTimeOfDay } from "@/lib/greeting";
import { useChatStore } from "@/stores/chat-store";
import Link from "next/link";
import {
  TrendingUp, Receipt, ArrowRight, Lightbulb, Target,
  FileText, Flag, Calculator, Info, MessageCircle, Store, Wallet,
} from "lucide-react";

type HealthStatus = "good" | "stable" | "attention" | "nodata";

export default function HomePage() {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const locale = useLocale();
  const period = format(new Date(), "yyyy-MM");
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const monthly = useExpensesMonthly(period);
  const trends = useExpenseTrends(6);
  const readiness = useReadiness();
  const recommendations = useRecommendations();
  const budget = useBudgetStatus(period);
  const savings = useSavingsGoals();
  const patterns = useMLPatterns();
  const forecast = useMLForecast();
  const debts = useDebts();
  const { setOpen: setChatOpen } = useChatStore();

  const totalIncome = monthly.data ? toNumber(monthly.data.total_income) : 0;
  const netCashFlow = monthly.data ? toNumber(monthly.data.net_cash_flow) : 0;
  const totalExpenses = monthly.data ? toNumber(monthly.data.total_expenses) : 0;
  const transactionCount = monthly.data?.transaction_count ?? 0;
  const totalSavings = savings.data?.reduce((s, g) => s + toNumber(g.current_amount), 0) ?? 0;
  const monthlyDebtPayments = debts.data?.reduce((s, d) => s + toNumber(d.monthly_payment), 0) ?? 0;
  const score = readiness.data?.score ?? 0;

  const changePercent = monthly.data?.change_percent != null ? toNumber(monthly.data.change_percent) : null;
  const todaysSales = monthly.data?.daily_breakdown?.[todayKey] != null
    ? toNumber(monthly.data.daily_breakdown[todayKey])
    : null;

  // ── AI Business Health (deterministic, derived only from real data) ──
  const bufferMonths = totalExpenses > 0 && totalSavings > 0 ? totalSavings / totalExpenses : null;
  const debtRatio = totalIncome > 0 ? (monthlyDebtPayments / totalIncome) * 100 : null;
  const hasDebt = monthlyDebtPayments > 0;

  let health: HealthStatus = "nodata";
  if (transactionCount > 0) {
    if (netCashFlow < 0 || (debtRatio != null && debtRatio > 40)) {
      health = "attention";
    } else if (netCashFlow > 0 && (changePercent == null || changePercent <= 15) && (!hasDebt || (debtRatio ?? 0) <= 30)) {
      health = "good";
    } else {
      health = "stable";
    }
  }

  const healthFacts: string[] = [];
  if (health !== "nodata") {
    healthFacts.push(
      netCashFlow >= 0
        ? t("netPositiveFact", { amount: formatCurrency(netCashFlow) })
        : t("netNegativeFact", { amount: formatCurrency(Math.abs(netCashFlow)) }),
    );
    if (changePercent != null) {
      healthFacts.push(t("expenseUpFact", { percent: formatPercent(changePercent) }));
    }
    if (bufferMonths != null && bufferMonths >= 0.25) {
      const label = bufferMonths >= 1 ? `${bufferMonths.toFixed(0)} month(s)` : `${Math.round(bufferMonths * 30)} days`;
      healthFacts.push(t("bufferFact", { months: label }));
    } else {
      healthFacts.push(t("opportunityBuffer"));
    }
    if (debtRatio != null && debtRatio > 30) {
      healthFacts.push(t("debtHeavyFact", { percent: `${debtRatio.toFixed(0)}%` }));
    }
  }

  const opportunity =
    changePercent != null && changePercent > 20
      ? t("opportunityExpense")
      : (debtRatio ?? 0) > 30
        ? t("opportunityDebt")
        : bufferMonths == null || bufferMonths < 1
          ? t("opportunityBuffer")
          : t("opportunityKeep");

  const trendData = trends.data?.points?.map((p) => {
    const income = toNumber(p.income ?? 0);
    const expenses = toNumber(p.total);
    return {
      period: p.period,
      income,
      expenses,
      net: income - expenses,
    };
  }) ?? [];

  const forecastData = forecast.data?.forecasts?.map((f) => ({
    period: f.forecast_month,
    expected: f.expected_cashflow,
    lower: f.lower_range ?? f.expected_cashflow,
    upper: f.upper_range ?? f.expected_cashflow,
  })) ?? [];
  const isInsufficientData = forecast.data?.status === "insufficient_data";

  const scoreProgress = Math.min(100, Math.max(0, score));
  const dashOffset = 283 - (283 * scoreProgress) / 100;
  const scoreStatus = score >= 80 ? t("readinessExcellent") : score >= 60 ? t("readinessGood") : score >= 40 ? t("readinessFair") : t("readinessLow");

  const greetingPeriod = getTimeOfDay();
  const greeting =
    greetingPeriod === "morning"
      ? t("greeting_morning")
      : greetingPeriod === "afternoon"
        ? t("greeting_afternoon")
        : greetingPeriod === "evening"
          ? t("greeting_evening")
          : t("greeting_night");

  const quickActions = [
    { label: t("logExpense"), desc: t("logExpenseDesc"), icon: FileText, href: `/${locale}/expenses` },
    { label: t("askFinai"), desc: t("askFinaiDesc"), icon: MessageCircle, onClick: () => setChatOpen(true) },
    { label: t("planIdea"), desc: t("planIdeaDesc"), icon: Store, href: `/${locale}/advisory` },
    { label: t("simulateLoan"), desc: t("simulateLoanDesc"), icon: Calculator, href: `/${locale}/borrowing` },
  ];

  const healthBadge =
    health === "good"
      ? { cls: "bg-primary/10 text-primary border-primary/20", iconCls: "text-primary" }
      : health === "stable"
        ? { cls: "bg-warning/10 text-warning border-warning/20", iconCls: "text-warning" }
        : health === "attention"
          ? { cls: "bg-destructive/10 text-destructive border-destructive/20", iconCls: "text-destructive" }
          : { cls: "bg-surface-container-high text-text-muted border-border", iconCls: "text-text-muted" };
  const healthLabel =
    health === "good" ? t("healthGood")
      : health === "stable" ? t("healthStable")
        : health === "attention" ? t("healthAttention")
          : t("healthNoData");

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="section-reveal">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary" suppressHydrationWarning>{greeting}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t("businessQuestion")} · {format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* AI Business Health — primary advisory card */}
      <div className="rounded-xl border border-border bg-surface-card p-5 relative overflow-hidden portfolio-card section-reveal section-reveal-delay-1">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-primary" />
            {t("businessHealth")}
          </p>
          <span className={`px-2.5 py-0.5 border rounded-full text-[11px] font-medium ${healthBadge.cls}`}>
            {healthLabel}
          </span>
        </div>
        {health === "nodata" ? (
          <p className="text-sm text-text-muted leading-relaxed max-w-3xl">{t("healthNoDataDesc")}</p>
        ) : (
          <>
            <ul className="space-y-1 max-w-3xl">
              {healthFacts.map((fact, i) => (
                <li key={i} className="text-sm text-text-muted leading-relaxed flex items-start gap-2">
                  <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${i === 0 ? "bg-primary" : "bg-text-muted/40"}`} />
                  {fact}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium text-text-secondary flex items-start gap-1.5 max-w-3xl">
              <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
              {opportunity}
            </p>
          </>
        )}
        <p className="mt-3 text-[10px] uppercase tracking-[0.06em] text-text-muted/60">{t("healthBasis")}</p>
      </div>

      {/* Business Summary — stat row */}
      <div className={`grid gap-px rounded-xl border border-border overflow-hidden bg-border section-reveal section-reveal-delay-2 ${todaysSales != null ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {todaysSales != null && (
          <div className="bg-surface-card p-4 stat-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">{t("todaysSales")}</p>
            <p className="text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
              {monthly.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(todaysSales)}
            </p>
            <p className="text-[11px] text-text-muted mt-1">{format(new Date(), "d MMM")}</p>
          </div>
        )}
        <div className="bg-surface-card p-4 stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">{t("monthlyRevenue")}</p>
          <p className="text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
            {monthly.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(totalIncome)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">This month</p>
        </div>
        <div className="bg-surface-card p-4 stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">{t("monthlyExpenses")}</p>
          <p className="text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
            {monthly.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(totalExpenses)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">This month</p>
        </div>
        <div className="bg-surface-card p-4 stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">{t("estimatedProfit")}</p>
          <p className={`text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] tabular-nums ${netCashFlow < 0 ? "text-destructive" : "text-primary"}`}>
            {monthly.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(netCashFlow)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">{netCashFlow >= 0 ? t("profitPositive") : t("profitNegative")}</p>
        </div>
      </div>

      {/* Cash structure row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 section-reveal section-reveal-delay-2">
        <Link href={`/${locale}/savings`} className="rounded-xl border border-border bg-surface-card p-4 stat-card interactive-card hover:border-primary/30 transition-colors block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />{t("availableCash")}</p>
          <p className="text-lg font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
            {savings.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(totalSavings + Math.max(netCashFlow, 0))}
          </p>
          <p className="text-[11px] text-text-muted mt-1">{t("availableCashDesc")}</p>
        </Link>
        <Link href={`/${locale}/debt`} className="rounded-xl border border-border bg-surface-card p-4 stat-card interactive-card hover:border-primary/30 transition-colors block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1 flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" />{t("upcomingPayments")}</p>
          <p className="text-lg font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
            {debts.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(monthlyDebtPayments)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">{debts.data?.length ?? 0} active</p>
        </Link>
        <Link href={`/${locale}/savings`} className="rounded-xl border border-border bg-surface-card p-4 stat-card interactive-card hover:border-primary/30 transition-colors block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1 flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" />{t("savingsBalance")}</p>
          <p className="text-lg font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
            {savings.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(totalSavings)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">{t("savingsBalanceDesc")}</p>
        </Link>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 section-reveal section-reveal-delay-3">
        {/* Business Credit Readiness */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-surface-card p-5 flex flex-col interactive-card">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{tc("businessCredit")}</h4>
            <Info className="h-3.5 w-3.5 text-text-muted/50" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            {readiness.isLoading ? (
              <Skeleton className="w-28 h-28 rounded-full" />
            ) : (
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="none" r="45" className="stroke-surface-container-high" strokeDasharray="283" strokeDashoffset="0" strokeWidth="7" />
                  <circle
                    className="transition-all duration-1000 ease-out"
                    cx="50" cy="50" fill="none" r="45" stroke="var(--primary)"
                    strokeDasharray="283" strokeDashoffset={dashOffset} strokeLinecap="round" strokeWidth="7"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary leading-none">{score}</span>
                  <span className="text-[10px] text-text-muted mt-0.5">/100</span>
                </div>
              </div>
            )}
            <div className="mt-2.5 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[11px] font-medium">
              {scoreStatus}
            </div>
          </div>
          <Link href={`/${locale}/readiness`} className="w-full mt-3 bg-surface-container-high border border-border text-text-primary font-medium py-1.5 rounded-lg hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 text-xs">
            View Analysis <ArrowRight className="h-3.5 w-3.5 icon-hover" />
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-surface-card p-5 flex flex-col interactive-card">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{tc("recentActivity")}</h4>
            <Link href={`/${locale}/expenses`} className="text-primary text-[11px] font-medium hover:underline">{tc("viewAll")}</Link>
          </div>
          <div className="flex flex-col gap-1">
            {trends.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : trendData.length > 0 ? (
              trendData.slice(0, 3).map((item, idx) => {
                const isIncome = item.income > item.expenses;
                return (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isIncome ? "bg-primary/10 text-primary" : "bg-surface-container-high text-text-muted"}`}>
                      {isIncome ? <TrendingUp className="h-3.5 w-3.5" /> : <Receipt className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium text-text-primary truncate">{isIncome ? tc("income") : tc("expense")} — {item.period}</h5>
                      <p className="text-[11px] text-text-muted">{isIncome ? tc("received") : tc("tracked")}</p>
                    </div>
                    <span className={`text-sm font-medium font-[family-name:var(--font-jetbrains-mono)] shrink-0 ${isIncome ? "text-primary" : "text-text-primary"}`}>
                      {isIncome ? "+" : "-"}{formatCurrency(isIncome ? item.income : item.expenses)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Receipt className="mb-2 h-6 w-6 text-text-muted/40" />
                <p className="text-xs text-text-muted">{tc("noRecentActivity")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">{t("quickActions")}</h4>
          {quickActions.map((action) => {
            const inner = (
              <>
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-text-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 quick-action-icon">
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">{action.label}</div>
                  <div className="text-[11px] text-text-muted truncate">{action.desc}</div>
                </div>
              </>
            );
            const cls = "w-full rounded-xl border border-border bg-surface-card p-3 flex items-center gap-3 hover:border-primary/30 hover:bg-surface-container-high transition-all group text-left quick-action";
            return action.href ? (
              <Link key={action.label} href={action.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <button key={action.label} type="button" onClick={action.onClick} className={`${cls} cursor-pointer`}>
                {inner}
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2 section-reveal section-reveal-delay-4">
        <ChartCard title={t("incomeVsExpenses")} subtitle="Monthly income vs expenses trend" badge={<Badge variant="outline">6 months</Badge>}>
          {trends.isLoading ? <ChartSkeleton variant="area" /> : trends.isError ? (
            <PageError message={tc("trendError")} onRetry={() => trends.refetch()} />
          ) : trendData.length ? (
            <FinancialTrendChart data={trendData} valueFormatter={(v) => formatCurrency(v)} />
          ) : (
            <div className="flex h-56 items-center justify-center text-xs text-text-muted">
              <p>{tc("noTrendData")}</p>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title={t("budgetStatus")}
          action={<Link href={`/${locale}/budget`} className="flex items-center gap-1 text-[11px] text-primary hover:underline">{tc("viewAll")} <ArrowRight className="h-3 w-3 icon-hover" /></Link>}
        >
          {budget.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : budget.isError ? (
            <PageError message={tc("budgetLoadError")} onRetry={() => budget.refetch()} />
          ) : budget.data?.length ? (
            <BudgetProgressList
              budgets={budget.data.slice(0, 4).map((b) => ({
                id: b.id,
                category: b.category,
                spent: toNumber(b.spent),
                limit: toNumber(b.limit_amount),
                percentUsed: toNumber(b.percent_used),
                remaining: toNumber(b.remaining),
              }))}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Target className="mb-2 h-6 w-6 text-text-muted/40" />
              <p className="text-xs text-text-muted">{t("noBudgets")}</p>
              <Link href={`/${locale}/budget`} className="mt-1 text-[11px] text-primary hover:underline">{tc("createBudget")}</Link>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Insights Row */}
      <div className="grid gap-4 lg:grid-cols-3 section-reveal section-reveal-delay-5">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("forecast")}</CardTitle>
              <Badge variant="outline">{tc("forecastDisclaimer")}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {forecast.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-5 w-full" /></div>
            ) : forecast.isError ? (
              <PageError message={t("forecastError")} onRetry={() => forecast.refetch()} />
            ) : isInsufficientData ? (
              <div className="space-y-2">
                {(forecast.data?.available_months ?? 0) === 0 ? (
                  <>
                    <p className="text-xs font-medium text-text-primary">{t("forecastNoTransactions")}</p>
                    <p className="text-xs text-text-muted">{t("forecastNoTransactionsDesc")}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium text-text-primary">{t("forecastInsufficient")}</p>
                    <p className="text-xs text-text-muted">{t("forecastInsufficientDesc")}</p>
                    <p className="text-xs text-text-muted">
                      {t("forecastAvailable", { count: forecast.data?.available_months ?? 0 })}
                      {" · "}
                      {t("forecastRequired", { count: forecast.data?.required_months ?? 3 })}
                    </p>
                  </>
                )}
              </div>
            ) : forecast.data?.expense_forecast || forecast.data?.income_forecast ? (
              <div className="space-y-2">
                {forecast.data.expense_forecast && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">{t("expectedExpenses")}</span>
                    <span className="font-medium font-[family-name:var(--font-jetbrains-mono)] text-text-primary">{formatCurrency(forecast.data.expense_forecast.predicted)}</span>
                  </div>
                )}
                {forecast.data.income_forecast && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">{t("expectedIncome")}</span>
                    <span className="font-medium font-[family-name:var(--font-jetbrains-mono)] text-text-primary">{formatCurrency(forecast.data.income_forecast.predicted)}</span>
                  </div>
                )}
                {forecast.data.expense_forecast && forecast.data.income_forecast && (
                  <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                    <span className="text-text-muted">{t("expectedSurplus")}</span>
                    <span className={`font-medium font-[family-name:var(--font-jetbrains-mono)] ${(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted) < 0 ? "text-destructive" : "text-primary"}`}>
                      {formatCurrency(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted)}
                    </span>
                  </div>
                )}
                {forecast.data.explanation?.slice(0, 1).map((e, i) => (
                  <p key={i} className="text-[11px] text-text-muted leading-relaxed">{e.description}</p>
                ))}
                <Link href={`/${locale}/cashflow`} className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                  {t("viewForecast")} <ArrowRight className="h-3 w-3 icon-hover" />
                </Link>
              </div>
            ) : forecastData.length ? (
              <div className="space-y-2">
                {forecast.data?.forecasts?.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">{f.forecast_month}</span>
                    <span className="font-medium font-[family-name:var(--font-jetbrains-mono)] text-text-primary">{formatCurrency(f.expected_cashflow)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">{tc("noData")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("insights")}</CardTitle>
          </CardHeader>
          <CardContent>
            {patterns.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
            ) : patterns.isError ? (
              <PageError message={patterns.error instanceof Error ? patterns.error.message : tc("error")} onRetry={() => patterns.refetch()} />
            ) : (patterns.data as { patterns?: Array<{ pattern: string; description: string }> } | undefined)?.patterns?.length ? (
              <div className="space-y-1.5">
                {(patterns.data as { patterns: Array<{ pattern: string; description: string }> }).patterns.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-container px-3 py-2">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <p className="text-[11px] text-text-muted leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            ) : monthly.data?.insights?.length ? (
              <div className="space-y-1.5">
                {monthly.data.insights.slice(0, 4).map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-container px-3 py-2">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <p className="text-[11px] text-text-muted leading-relaxed">{ins}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted py-4 text-center">{tc("noInsightsYet")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{tc("aiRecommendations")}</CardTitle>
              <Link href={`/${locale}/recommendations`} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                {tc("viewAll")} <ArrowRight className="h-3 w-3 icon-hover" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recommendations.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : recommendations.isError ? (
              <PageError message={recommendations.error instanceof Error ? recommendations.error.message : tc("error")} onRetry={() => recommendations.refetch()} />
            ) : recommendations.data?.recommendations?.length ? (
              <div className="space-y-1.5">
                {recommendations.data.recommendations.slice(0, 3).map((r, i) => (
                  <div key={i} className="rounded-lg border border-border p-2.5 transition-colors hover:bg-surface-container-high recommendation-card">
                    <p className="text-xs font-medium leading-snug text-text-primary">{r.title}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted line-clamp-2">{r.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted py-4 text-center">{tc("noRecommendationsYet")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
