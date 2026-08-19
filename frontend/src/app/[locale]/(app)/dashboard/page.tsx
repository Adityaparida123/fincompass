"use client";

import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { ResponsiveBarChart, ResponsiveLineChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import {
  useExpensesMonthly, useExpenseTrends, useReadiness,
  useRecommendations, useNotifications, useBudgetStatus, useSavingsGoals,
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
  const notifications = useNotifications(true);
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
    <div className="space-y-6">
      {/* Welcome + Portfolio Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-[28px] leading-[36px] font-semibold tracking-[-0.01em]">{t("greeting")}</h1>
          <p className="text-[14px] leading-[20px] text-text-muted mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="glass-panel rounded-xl p-5 min-w-[280px] relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-28 h-28 bg-primary/8 rounded-full blur-2xl" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-1.5">TOTAL PORTFOLIO VALUE</p>
          <h3 className="text-[36px] leading-[44px] font-bold tracking-[-0.02em] font-[family-name:var(--font-jetbrains-mono)] text-text-primary">
            {monthly.isLoading ? "--" : formatCurrency(totalIncome + totalSavings)}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            {changePercent != null && (
              <div className="flex items-center justify-center bg-primary/15 text-primary rounded-full px-2 py-0.5 gap-1">
                <TrendingUp className="h-3 w-3" />
                <span className="text-[13px] leading-[18px] font-semibold">{formatPercent(changePercent)}</span>
              </div>
            )}
            <span className="text-[13px] leading-[18px] text-text-muted">All time</span>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Credit Readiness */}
        <div className="lg:col-span-4 glass-panel rounded-xl p-5 flex flex-col relative group">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none" />
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">Credit Readiness</h4>
            <Info className="h-3.5 w-3.5 text-text-muted/50" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative my-2">
            {readiness.isLoading ? (
              <Skeleton className="w-36 h-36 rounded-full" />
            ) : (
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="none" r="45" className="stroke-surface-container-high" strokeDasharray="283" strokeDashoffset="0" strokeWidth="7" />
                  <circle
                    className="transition-all duration-1000 ease-out"
                    cx="50" cy="50" fill="none" r="45" stroke="var(--primary)"
                    strokeDasharray="283" strokeDashoffset={dashOffset} strokeLinecap="round" strokeWidth="7"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[40px] leading-[48px] font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary leading-none">{score}</span>
                  <span className="text-[12px] leading-[16px] text-text-muted mt-0.5">/100</span>
                </div>
              </div>
            )}
            <div className="mt-3 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[12px] leading-[16px] font-medium">
              {scoreStatus}
            </div>
          </div>
          <Link href={`/${locale}/readiness`} className="w-full mt-3 bg-surface-container-high/60 border border-border-subtle text-text-primary font-medium py-2.5 rounded-lg hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 text-[13px]">
            View Analysis
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-5 glass-panel rounded-xl p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">Recent Activity</h4>
            <Link href={`/${locale}/expenses`} className="text-primary text-[12px] font-medium hover:underline">View All</Link>
          </div>
          <div className="flex flex-col gap-3">
            {trends.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : trendData.length > 0 ? (
              trendData.slice(0, 3).map((item, idx) => {
                const isIncome = item.income > item.expenses;
                return (
                  <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-container-high/60 transition-colors group cursor-pointer border border-transparent hover:border-border-subtle">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isIncome ? "bg-primary/10 text-primary group-hover:bg-primary/20" : "bg-surface-container-high text-text-muted group-hover:text-foreground"}`}>
                      {isIncome ? <TrendingUp className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-[14px] leading-[20px] font-medium text-text-primary truncate">{isIncome ? "Income" : "Expense"} — {item.period}</h5>
                      <p className="text-[12px] leading-[16px] text-text-muted">{isIncome ? "Received" : "Tracked"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[14px] leading-[20px] font-medium font-[family-name:var(--font-jetbrains-mono)] ${isIncome ? "text-primary" : "text-text-primary"}`}>
                        {isIncome ? "+" : "-"}{formatCurrency(isIncome ? item.income : item.expenses)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Receipt className="mb-2 h-7 w-7 text-text-muted/40" />
                <p className="text-[13px] text-text-muted">No recent activity yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">Quick Actions</h4>
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="w-full glass-panel p-3.5 rounded-xl flex items-center gap-3 border border-border-subtle hover:border-primary/40 hover:bg-surface-container-high/40 transition-all group text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-text-muted group-hover:bg-primary group-hover:text-on-primary-container transition-colors shrink-0">
                <action.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] leading-[18px] font-medium text-text-primary">{action.label}</div>
                <div className="text-[11px] leading-[14px] text-text-muted truncate">{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{t("incomeVsExpenses")}</CardTitle>
              <Badge variant="outline">6 months</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {trends.isLoading ? <ChartSkeleton /> : trends.isError ? (
              <PageError message="Unable to load spending trends." onRetry={() => trends.refetch()} />
            ) : trendData.length ? (
              <ResponsiveBarChart data={trendData} xKey="period" valueFormatter={(v) => formatCurrency(v)} bars={[
                { key: "income", name: "Income", color: "#5fd4c6" },
                { key: "expenses", name: "Expenses", color: "#818cf8" },
              ]} />
            ) : (
              <div className="flex h-56 items-center justify-center text-[13px] text-text-muted">
                <p>No trend data yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{t("budgetStatus")}</CardTitle>
              <Link href={`/${locale}/budget`} className="flex items-center gap-1 text-[12px] text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {budget.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : budget.isError ? (
              <PageError message="Unable to load budget status." onRetry={() => budget.refetch()} />
            ) : budget.data?.length ? (
              budget.data.slice(0, 4).map((b) => {
                const pctUsed = toNumber(b.percent_used);
                const over = pctUsed > 100;
                const nearing = pctUsed > 80 && !over;
                return (
                  <div key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="capitalize font-medium text-text-primary">{b.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted text-[12px]">{formatCurrency(toNumber(b.spent))} / {formatCurrency(toNumber(b.limit_amount))}</span>
                        {over && <Badge variant="destructive">Over</Badge>}
                        {nearing && <Badge variant="secondary">Near</Badge>}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${over ? "bg-destructive" : nearing ? "bg-warning" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, pctUsed)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Target className="mb-2 h-7 w-7 text-text-muted/40" />
                <p className="text-[13px] text-text-muted">{t("noBudgets")}</p>
                <Link href={`/${locale}/budget`} className="mt-1.5 text-[12px] text-primary hover:underline">Create a budget</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insights Row */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{t("forecast")}</CardTitle>
              {forecast.data?.forecast_quality && (
                <Badge variant={forecast.data.forecast_quality === "good" ? "success" : forecast.data.forecast_quality === "moderate" ? "secondary" : "outline"}>
                  {forecast.data.forecast_quality}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {forecast.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-6 w-full" /></div>
            ) : forecast.isError ? (
              <PageError message="Forecast temporarily unavailable." onRetry={() => forecast.refetch()} />
            ) : isInsufficientData ? (
              <div className="space-y-2">
                {(forecast.data?.available_months ?? 0) === 0 ? (
                  <>
                    <p className="text-[13px] font-medium text-text-primary">{t("forecastNoTransactions")}</p>
                    <p className="text-[12px] text-text-muted">{t("forecastNoTransactionsDesc")}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-text-primary">{t("forecastInsufficient")}</p>
                    <p className="text-[12px] text-text-muted">{t("forecastInsufficientDesc")}</p>
                    <p className="text-[12px] text-text-muted">
                      {t("forecastAvailable", { count: forecast.data?.available_months ?? 0 })}
                      {" · "}
                      {t("forecastRequired", { count: forecast.data?.required_months ?? 3 })}
                    </p>
                  </>
                )}
              </div>
            ) : forecast.data?.expense_forecast || forecast.data?.income_forecast ? (
              <div className="space-y-2.5">
                {forecast.data.expense_forecast && (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-text-muted">{t("expectedExpenses")}</span>
                    <span className="font-medium font-[family-name:var(--font-jetbrains-mono)] text-text-primary">{formatCurrency(forecast.data.expense_forecast.predicted)}</span>
                  </div>
                )}
                {forecast.data.income_forecast && (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-text-muted">{t("expectedIncome")}</span>
                    <span className="font-medium font-[family-name:var(--font-jetbrains-mono)] text-text-primary">{formatCurrency(forecast.data.income_forecast.predicted)}</span>
                  </div>
                )}
                {forecast.data.expense_forecast && forecast.data.income_forecast && (
                  <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-[13px]">
                    <span className="text-text-muted">{t("expectedSurplus")}</span>
                    <span className={`font-medium font-[family-name:var(--font-jetbrains-mono)] ${(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted) < 0 ? "text-destructive" : "text-primary"}`}>
                      {formatCurrency(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted)}
                    </span>
                  </div>
                )}
                {forecast.data.explanation?.slice(0, 1).map((e, i) => (
                  <p key={i} className="text-[11px] text-text-muted leading-relaxed">{e.description}</p>
                ))}
                <Link href={`/${locale}/cashflow`} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                  View forecast <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : forecastData.length ? (
              <div className="space-y-2">
                {forecast.data?.forecasts?.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[13px]">
                    <span className="text-text-muted">{f.forecast_month}</span>
                    <span className="font-medium font-[family-name:var(--font-jetbrains-mono)] text-text-primary">{formatCurrency(f.expected_cashflow)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-text-muted">{tc("noData")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{t("insights")}</CardTitle>
          </CardHeader>
          <CardContent>
            {patterns.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-full" /></div>
            ) : patterns.isError ? (
              <PageError message={patterns.error instanceof Error ? patterns.error.message : tc("error")} onRetry={() => patterns.refetch()} />
            ) : (patterns.data as { patterns?: Array<{ pattern: string; description: string }> } | undefined)?.patterns?.length ? (
              <div className="space-y-2">
                {(patterns.data as { patterns: Array<{ pattern: string; description: string }> }).patterns.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-container/60 px-3 py-2 border border-border-subtle">
                    <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                    <p className="text-[12px] text-text-muted leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            ) : monthly.data?.insights?.length ? (
              <div className="space-y-2">
                {monthly.data.insights.slice(0, 4).map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-container/60 px-3 py-2 border border-border-subtle">
                    <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                    <p className="text-[12px] text-text-muted leading-relaxed">{ins}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-text-muted py-4 text-center">No insights yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">Recommendations</CardTitle>
              <Link href={`/${locale}/recommendations`} className="flex items-center gap-1 text-[12px] text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recommendations.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : recommendations.isError ? (
              <PageError message={recommendations.error instanceof Error ? recommendations.error.message : tc("error")} onRetry={() => recommendations.refetch()} />
            ) : recommendations.data?.recommendations?.length ? (
              <div className="space-y-2">
                {recommendations.data.recommendations.slice(0, 3).map((r, i) => (
                  <div key={i} className="rounded-lg border border-border-subtle p-3 transition-colors hover:bg-surface-container-high/60">
                    <p className="text-[13px] font-medium leading-snug text-text-primary">{r.title}</p>
                    <p className="mt-0.5 text-[12px] text-text-muted line-clamp-2">{r.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-text-muted py-4 text-center">No recommendations yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
