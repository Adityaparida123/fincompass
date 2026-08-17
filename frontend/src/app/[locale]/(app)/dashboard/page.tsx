"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { ResponsiveBarChart, ResponsiveLineChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { StatCard } from "@/components/common/shared";
import {
  useExpensesMonthly, useExpenseTrends, useReadiness,
  useRecommendations, useNotifications, useBudgetStatus, useSavingsGoals,
  useMLPatterns, useMLForecast,
} from "@/hooks/use-api";
import { formatCurrency, toNumber, formatPercent } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, Wallet, Receipt, Gauge, PiggyBank, ArrowRight, Lightbulb, Bell, Target } from "lucide-react";

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

  const totalIncome = monthly.data ? toNumber(monthly.data.total_income) : 0;
  const netCashFlow = monthly.data ? toNumber(monthly.data.net_cash_flow) : 0;
  const totalExpenses = monthly.data ? toNumber(monthly.data.total_expenses) : 0;
  const totalSavings = savings.data?.reduce((s, g) => s + toNumber(g.current_amount), 0) ?? 0;
  const score = readiness.data?.score ?? 0;
  const unreadNotifs = notifications.data?.unread ?? 0;

  const changePercent = monthly.data?.change_percent != null ? toNumber(monthly.data.change_percent) : null;
  const trendDirection = monthly.data?.trend_direction as "up" | "down" | "flat" | undefined;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("greeting")}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("income")} value={formatCurrency(totalIncome)} icon={TrendingUp} loading={monthly.isLoading} subtitle={changePercent != null ? formatPercent(changePercent) : undefined} trend={trendDirection === "up" ? "up" : trendDirection === "down" ? "down" : undefined} />
        <StatCard label={t("expenses")} value={formatCurrency(totalExpenses)} icon={Receipt} loading={monthly.isLoading} />
        <StatCard label={t("cashFlow")} value={formatCurrency(netCashFlow)} icon={Wallet} loading={monthly.isLoading} subtitle={netCashFlow >= 0 ? "Positive cash flow" : "Negative cash flow"} trend={netCashFlow >= 0 ? "up" : "down"} />
        <StatCard label={t("readiness")} value={`${score}/100`} icon={Gauge} loading={readiness.isLoading} subtitle={`${unreadNotifs} unread notifications`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{t("incomeVsExpenses")}</CardTitle>
              <Badge variant="outline" className="text-[10px]">6 months</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {trends.isLoading ? <ChartSkeleton /> : trends.isError ? (
              <PageError message="Unable to load spending trends." onRetry={() => trends.refetch()} />
            ) : trendData.length ? (
              <ResponsiveBarChart data={trendData} xKey="period" valueFormatter={(v) => formatCurrency(v)} bars={[
                { key: "income", name: "Income", color: "#14b8a6" },
                { key: "expenses", name: "Expenses", color: "#818cf8" },
              ]} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                <p>No trend data yet. Add transactions to see trends.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{t("budgetStatus")}</CardTitle>
              <Link href="/budget" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {budget.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : budget.isError ? (
              <PageError message="Unable to load budget status." onRetry={() => budget.refetch()} />
            ) : budget.data?.length ? (
              budget.data.slice(0, 5).map((b) => {
                const pctUsed = toNumber(b.percent_used);
                const over = pctUsed > 100;
                const nearing = pctUsed > 80 && !over;
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{b.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{formatCurrency(toNumber(b.spent))} / {formatCurrency(toNumber(b.limit_amount))}</span>
                        {over && <Badge variant="destructive" className="text-[10px]">Over</Badge>}
                        {nearing && <Badge variant="secondary" className="text-[10px]">Near limit</Badge>}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${over ? "bg-destructive" : nearing ? "bg-warning" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, pctUsed)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Target className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("noBudgets")}</p>
                <Link href="/budget" className="mt-2 text-xs text-primary hover:underline">Create a budget</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{t("forecast")}</CardTitle>
              {forecast.data?.forecast_quality && (
                <Badge variant={forecast.data.forecast_quality === "good" ? "success" : forecast.data.forecast_quality === "moderate" ? "secondary" : "outline"} className="text-[10px]">
                  {forecast.data.forecast_quality}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {forecast.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : forecast.isError ? (
              <PageError message="Forecast temporarily unavailable." onRetry={() => forecast.refetch()} />
            ) : isInsufficientData ? (
              <div className="space-y-2">
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
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("expectedExpenses")}</span>
                    <span className="font-medium">{formatCurrency(forecast.data.expense_forecast.predicted)}</span>
                  </div>
                )}
                {forecast.data.income_forecast && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("expectedIncome")}</span>
                    <span className="font-medium">{formatCurrency(forecast.data.income_forecast.predicted)}</span>
                  </div>
                )}
                {forecast.data.expense_forecast && forecast.data.income_forecast && (
                  <div className="flex items-center justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">{t("expectedSurplus")}</span>
                    <span className={`font-medium ${(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted) < 0 ? "text-destructive" : "text-income"}`}>
                      {formatCurrency(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted)}
                    </span>
                  </div>
                )}
                {forecast.data.explanation?.slice(0, 1).map((e, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">{e.description}</p>
                ))}
                <Link href="/cashflow" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  View forecast <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : forecastData.length ? (
              <div className="space-y-2">
                {forecast.data?.forecasts?.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{f.forecast_month}</span>
                    <span className="font-medium">{formatCurrency(f.expected_cashflow)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tc("noData")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("insights")}</CardTitle>
          </CardHeader>
          <CardContent>
            {patterns.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : (patterns.data as { patterns?: Array<{ pattern: string; description: string }> } | undefined)?.patterns?.length ? (
              <div className="space-y-2">
                {(patterns.data as { patterns: Array<{ pattern: string; description: string }> }).patterns.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            ) : monthly.data?.insights?.length ? (
              <div className="space-y-2">
                {monthly.data.insights.slice(0, 4).map((ins, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{ins}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No insights yet. Add transactions to see patterns.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
              <Link href="/recommendations" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recommendations.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : recommendations.data?.recommendations?.length ? (
              <div className="space-y-2">
                {recommendations.data.recommendations.slice(0, 3).map((r, i) => (
                  <div key={i} className="rounded-lg border border-muted/50 p-3 transition-colors hover:bg-muted/20">
                    <p className="text-sm font-medium leading-snug">{r.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No recommendations yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
