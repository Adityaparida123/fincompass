"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/input";
import { ResponsiveBarChart, ResponsiveLineChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import {
  useExpensesMonthly, useExpenseTrends, useReadiness,
  useRecommendations, useNotifications, useBudgetStatus, useSavingsGoals, useMLPatterns,
} from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const period = format(new Date(), "yyyy-MM");

  const monthly = useExpensesMonthly(period);
  const trends = useExpenseTrends(6);
  const readiness = useReadiness();
  const recommendations = useRecommendations();
  const notifications = useNotifications(true);
  const budget = useBudgetStatus(period);
  const savings = useSavingsGoals();
  const patterns = useMLPatterns();

  const netCashFlow = monthly.data ? parseFloat(monthly.data.net_cash_flow) : 0;
  const totalExpenses = monthly.data ? parseFloat(monthly.data.total_expenses) : 0;
  const totalSavings = savings.data?.reduce((s, g) => s + parseFloat(g.current_amount), 0) ?? 0;
  const score = readiness.data?.score ?? 0;

  const trendData = trends.data?.points?.map((p) => ({
    period: p.period,
    expenses: parseFloat(p.total),
    income: p.income ? parseFloat(p.income) : 0,
  })) ?? [];

  const stats = [
    { label: t("cashFlow"), value: formatCurrency(netCashFlow), loading: monthly.isLoading },
    { label: t("savings"), value: formatCurrency(totalSavings), loading: savings.isLoading },
    { label: t("expenses"), value: formatCurrency(totalExpenses), loading: monthly.isLoading },
    { label: t("readiness"), value: `${score}/100`, loading: readiness.isLoading },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("greeting")} 👋</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {s.loading ? <Skeleton className="h-8 w-24" /> : (
                <p className="text-2xl font-bold">{s.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("incomeVsExpenses")}</CardTitle></CardHeader>
          <CardContent>
            {trends.isLoading ? <ChartSkeleton /> : trends.isError ? (
              <PageError message="Unable to load chart data." onRetry={() => trends.refetch()} />
            ) : (
              <ResponsiveBarChart data={trendData} xKey="period" bars={[
                { key: "income", name: "Income", color: "#0d9488" },
                { key: "expenses", name: "Expenses", color: "#6366f1" },
              ]} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("budgetStatus")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {budget.isLoading ? <Skeleton className="h-32 w-full" /> : budget.data?.length ? (
              budget.data.slice(0, 5).map((b) => (
                <div key={b.id}>
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{b.category}</span>
                    <span>{formatCurrency(parseFloat(b.spent))} / {formatCurrency(parseFloat(b.limit_amount))}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${b.percent_used > 100 ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, b.percent_used)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : <p className="text-sm text-muted-foreground">No budgets set yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("insights")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {patterns.isLoading ? <Skeleton className="h-20 w-full" /> : (patterns.data as { patterns?: Array<{ pattern: string; description: string }> } | undefined)?.patterns?.length ? (
              (patterns.data as { patterns: Array<{ pattern: string; description: string }> }).patterns.slice(0, 4).map((p, i) => (
                <p key={i} className="text-sm text-muted-foreground">{p.description}</p>
              ))
            ) : monthly.data?.insights?.map((ins, i) => (
              <p key={i} className="text-sm text-muted-foreground">{ins}</p>
            )) ?? <p className="text-sm text-muted-foreground">No insights yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recommendations.isLoading ? <Skeleton className="h-20 w-full" /> : recommendations.data?.recommendations?.slice(0, 3).map((r, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="font-medium text-sm">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
              </div>
            )) ?? <p className="text-sm text-muted-foreground">No recommendations yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
