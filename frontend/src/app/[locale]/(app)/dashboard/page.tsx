"use client";

import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { FinancialTrendChart, ChartCard, BudgetProgressList, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import {
  useExpensesMonthly, useExpenseTrends, useReadiness,
  useRecommendations, useBudgetStatus, useSavingsGoals,
  useMLPatterns, useMLForecast,
} from "@/hooks/use-api";
import { formatCurrency, toNumber, formatPercent } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, Receipt, ArrowRight, Lightbulb, Target, FileText, Flag, Calculator, Info } from "lucide-react";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const period = format(new Date(), "yyyy-MM");

  const monthly = useExpensesMonthly(period);
  const trends = useExpenseTrends(6);
  const readiness = useReadiness();
  const recommendations = useRecommendations();
  const budget = useBudgetStatus(period);
  const savings = useSavingsGoals();
  const patterns = useMLPatterns();
  const forecast = useMLForecast();

  const totalIncome = monthly.data ? toNumber(monthly.data.total_income) : 0;
  const netCashFlow = monthly.data ? toNumber(monthly.data.net_cash_flow) : 0;
  const totalExpenses = monthly.data ? toNumber(monthly.data.total_expenses) : 0;
  const totalSavings = savings.data?.reduce((s, g) => s + toNumber(g.current_amount), 0) ?? 0;
  const score = readiness.data?.score ?? 0;

  const changePercent = monthly.data?.change_percent != null ? toNumber(monthly.data.change_percent) : null;

  const trendData = trends.data?.points?.map((p) => ({
    period: p.period,
    income: toNumber(p.income ?? 0),
    expenses: toNumber(p.total),
  })) ?? [];

  const forecastData = forecast.data?.forecasts?.map((f) => ({
    period: f.forecast_month,
    expected: f.expected_cashflow,
    lower: f.lower_range ?? f.expected_cashflow,
    upper: f.upper_range ?? f.expected_cashflow,
  })) ?? [];
  const isInsufficientData = forecast.data?.status === "insufficient_data";

  const scoreProgress = Math.min(100, Math.max(0, score));
  const dashOffset = 283 - (283 * scoreProgress) / 100;
  const scoreStatus = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Work";

  const quickActions = [
    { label: "Log Expense", desc: "Record a manual entry", icon: FileText, href: `/${locale}/expenses` },
    { label: "New Savings Goal", desc: "Set a target milestone", icon: Flag, href: `/${locale}/savings` },
    { label: "Simulate Loan", desc: "Calculate EMIs & Rates", icon: Calculator, href: `/${locale}/borrowing` },
  ];

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div className="section-reveal">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{t("greeting")}</h1>
        <p className="text-sm text-text-muted mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Portfolio Value — Primary metric */}
      <div className="rounded-xl border border-border bg-surface-card p-5 relative overflow-hidden portfolio-card section-reveal section-reveal-delay-1">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">Total Portfolio Value</p>
        <h2 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)] text-text-primary transition-colors duration-250 portfolio-value">
          {monthly.isLoading ? (
            <Skeleton className="h-8 w-40 inline-block" />
          ) : (
            formatCurrency(totalIncome + totalSavings)
          )}
        </h2>
        <div className="flex items-center gap-3 mt-2 portfolio-meta transition-opacity duration-200" style={{ opacity: 0.85 }}>
          {changePercent != null && (
            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
              <TrendingUp className="h-3 w-3" />
              {formatPercent(changePercent)}
            </span>
          )}
          <span className="text-xs text-text-muted">All time</span>
        </div>
      </div>

      {/* Financial Summary — Clean row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-xl border border-border overflow-hidden bg-border section-reveal section-reveal-delay-2">
        <div className="bg-surface-card p-4 stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">Income</p>
          <p className="text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
            {monthly.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(totalIncome)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">This month</p>
        </div>
        <div className="bg-surface-card p-4 stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">Expenses</p>
          <p className="text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
            {monthly.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(totalExpenses)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">This month</p>
        </div>
        <div className="bg-surface-card p-4 stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">Net Cash Flow</p>
          <p className={`text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] tabular-nums ${netCashFlow < 0 ? "text-destructive" : "text-primary"}`}>
            {monthly.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(netCashFlow)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">{netCashFlow >= 0 ? "Positive" : "Negative"} cash flow</p>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 section-reveal section-reveal-delay-3">
        {/* Credit Readiness */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-surface-card p-5 flex flex-col interactive-card">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Credit Readiness</h4>
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
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Recent Activity</h4>
            <Link href={`/${locale}/expenses`} className="text-primary text-[11px] font-medium hover:underline">View All</Link>
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
                      <h5 className="text-sm font-medium text-text-primary truncate">{isIncome ? "Income" : "Expense"} — {item.period}</h5>
                      <p className="text-[11px] text-text-muted">{isIncome ? "Received" : "Tracked"}</p>
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
                <p className="text-xs text-text-muted">No recent activity yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-3 flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">Quick Actions</h4>
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="w-full rounded-xl border border-border bg-surface-card p-3 flex items-center gap-3 hover:border-primary/30 hover:bg-surface-container-high transition-all group text-left quick-action"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-text-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 quick-action-icon">
                <action.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">{action.label}</div>
                <div className="text-[11px] text-text-muted truncate">{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2 section-reveal section-reveal-delay-4">
        <ChartCard title={t("incomeVsExpenses")} subtitle="Monthly income vs expenses trend" badge={<Badge variant="outline">6 months</Badge>}>
          {trends.isLoading ? <ChartSkeleton variant="area" /> : trends.isError ? (
            <PageError message="Unable to load spending trends." onRetry={() => trends.refetch()} />
          ) : trendData.length ? (
            <FinancialTrendChart data={trendData} valueFormatter={(v) => formatCurrency(v)} />
          ) : (
            <div className="flex h-56 items-center justify-center text-xs text-text-muted">
              <p>No trend data yet.</p>
            </div>
          )}
        </ChartCard>

        <ChartCard 
          title={t("budgetStatus")} 
          action={<Link href={`/${locale}/budget`} className="flex items-center gap-1 text-[11px] text-primary hover:underline">View all <ArrowRight className="h-3 w-3 icon-hover" /></Link>}
        >
          {budget.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : budget.isError ? (
            <PageError message="Unable to load budget status." onRetry={() => budget.refetch()} />
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
              <Link href={`/${locale}/budget`} className="mt-1 text-[11px] text-primary hover:underline">Create a budget</Link>
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
              {forecast.data?.forecast_quality && (
                <Badge variant={forecast.data.forecast_quality === "good" ? "success" : forecast.data.forecast_quality === "moderate" ? "secondary" : "outline"}>
                  {forecast.data.forecast_quality}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {forecast.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-5 w-full" /></div>
            ) : forecast.isError ? (
              <PageError message="Forecast temporarily unavailable." onRetry={() => forecast.refetch()} />
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
                  View forecast <ArrowRight className="h-3 w-3 icon-hover" />
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
              <p className="text-xs text-text-muted py-4 text-center">No insights yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Recommendations</CardTitle>
              <Link href={`/${locale}/recommendations`} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3 icon-hover" />
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
              <p className="text-xs text-text-muted py-4 text-center">No recommendations yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
