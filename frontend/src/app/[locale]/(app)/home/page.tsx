"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { FinancialTrendChart, ChartCard, BudgetProgressList, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import {
  useExpensesMonthly, useExpenseTrends, useReadiness, useFinancialHealth,
  useRecommendations, useBudgetStatus, useSavingsGoals,
  useMLPatterns, useMLForecast, useDebts,
  useBusinessProfile, useRecommendedSchemes,
} from "@/hooks/use-api";
import { formatCurrency, toNumber, formatPercent } from "@/lib/utils";
import { getTimeOfDay } from "@/lib/greeting";
import { generateBusinessInsights, type BusinessInsight } from "@/lib/insight-engine";
import { classifyScope } from "@/lib/expense-scope";
import { buildActionPlans, groupByPriority, type ActionPriority } from "@/lib/action-plan";
import { useChatStore } from "@/stores/chat-store";
import { useAuthStore } from "@/stores/auth-store";
import Link from "next/link";
import {
  TrendingUp, Receipt, ArrowRight, Lightbulb, Target,
  FileText, Flag, Calculator, Info, MessageCircle, Store, Wallet,
  Sparkles, AlertTriangle, Landmark, ExternalLink, CircleHelp,
  ListChecks, Eye,
} from "lucide-react";

type HealthStatus = "good" | "stable" | "attention" | "nodata";

const INSIGHT_SEVERITY_STYLES: Record<
  BusinessInsight["severity"],
  { wrap: string; iconCls: string; Icon: typeof Lightbulb }
> = {
  critical: { wrap: "border-destructive/30 bg-destructive/5", iconCls: "text-destructive", Icon: AlertTriangle },
  warning: { wrap: "border-warning/30 bg-warning/5", iconCls: "text-warning", Icon: AlertTriangle },
  info: { wrap: "border-primary/25 bg-primary/5", iconCls: "text-primary", Icon: Info },
  positive: { wrap: "border-primary/25 bg-primary/5", iconCls: "text-primary", Icon: TrendingUp },
};

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
  const businessProfile = useBusinessProfile();
  const healthQuery = useFinancialHealth();
  const { setOpen: setChatOpen, setDraft } = useChatStore();
  const user = useAuthStore((s) => s.user);

  const hasBizContext = !!businessProfile.data && (!!businessProfile.data.state || !!businessProfile.data.business_type);
  const localSchemes = useRecommendedSchemes(hasBizContext);

  const askFinai = (question: string) => {
    setDraft(question);
    setChatOpen(true);
  };

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

  // ── AI Business Insights (structured: what happened / why / action) ──
  const insights = useMemo(
    () => generateBusinessInsights({
      monthly: monthly.data ?? null,
      trends: trends.data ?? null,
      forecast: forecast.data ?? null,
      debts: debts.data ?? null,
      savingsGoals: savings.data ?? null,
    }),
    [monthly.data, trends.data, forecast.data, debts.data, savings.data],
  );

  const askInsightDraft = (insight: BusinessInsight, tHeadline: string, tAction: string) =>
    t("insightAskDraft", { headline: tHeadline, action: tAction });

  // ── Business vs Personal expense split (this month) ─────────────
  const scopeSplit = useMemo(() => {
    const categories = monthly.data?.categories;
    if (!categories || transactionCount === 0) return null;
    const split = { business: 0, personal: 0, mixed: 0 };
    for (const [category, value] of Object.entries(categories)) {
      split[classifyScope(category)] += toNumber(value);
    }
    const total = split.business + split.personal + split.mixed;
    return total > 0 ? { ...split, total } : null;
  }, [monthly.data, transactionCount]);

  const forecastData = forecast.data?.forecasts?.map((f) => ({
    period: f.forecast_month,
    expected: f.expected_cashflow,
    lower: f.lower_range ?? f.expected_cashflow,
    upper: f.upper_range ?? f.expected_cashflow,
  })) ?? [];
  const isInsufficientData = forecast.data?.status === "insufficient_data";

  // ── Action Plan (prioritized buckets of the recommendation engine) ──
  const actionPlans = useMemo(
    () => groupByPriority(buildActionPlans(recommendations.data?.recommendations ?? [])),
    [recommendations.data],
  );
  const actionBuckets: Array<{
    key: ActionPriority;
    label: string;
    desc: string;
    icon: typeof ListChecks;
    wrap: string;
    hasItems: boolean;
  }> = [
    { key: "high", label: t("planHigh"), desc: t("planHighDesc"), icon: ListChecks, wrap: "border-destructive/25 bg-destructive/5", hasItems: actionPlans.high.length > 0 },
    { key: "medium", label: t("planMedium"), desc: t("planMediumDesc"), icon: Target, wrap: "border-warning/25 bg-warning/5", hasItems: actionPlans.medium.length > 0 },
    { key: "opportunity", label: t("planOpportunity"), desc: t("planOpportunityDesc"), icon: Lightbulb, wrap: "border-primary/25 bg-primary/5", hasItems: actionPlans.opportunity.length > 0 },
    { key: "monitor", label: t("planMonitor"), desc: t("planMonitorDesc"), icon: Eye, wrap: "border-border bg-surface-container", hasItems: actionPlans.monitor.length > 0 },
  ];
  const hasActionPlan = Object.values(actionPlans).some((items) => items.length > 0);

  const healthResult = healthQuery.data;
  const hasHealthScore = !!healthResult && !healthResult.insufficient_data;
  const healthLabelValue =
    healthResult?.label === "Good" ? t("healthScoreGood")
      : healthResult?.label === "Moderate" ? t("healthScoreModerate")
        : healthResult?.label === "Needs attention" ? t("healthScoreAttention")
          : t("healthNoData");
  const healthChange = healthResult?.change;
  const healthArcOffset = 283 - (283 * Math.min(100, Math.max(0, healthResult?.score ?? 0))) / 100;
  const weakestFactors = [...(healthResult?.factors ?? [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

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

  const firstName = user?.full_name?.trim().split(/\s+/)[0] ?? "";
  const displayName = firstName.length > 0 && firstName.length <= 20 ? firstName : "";

  const bizLabelParts = [
    businessProfile.data?.business_type?.replace(/_/g, " ") || "",
    businessProfile.data?.village || businessProfile.data?.district || "",
  ].filter(Boolean);
  const bizContextLine = bizLabelParts.length > 0 ? bizLabelParts.join(" · ") : "";

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
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary" suppressHydrationWarning>
          {displayName ? t("greetingWithName", { greeting, name: displayName }) : greeting}
        </h1>
        <p className="text-sm text-text-muted mt-0.5 flex flex-wrap items-center gap-x-1.5">
          {bizContextLine && (
            <>
              <Store className="h-3.5 w-3.5 text-primary/70 shrink-0" />
              <span className="capitalize">{bizContextLine}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
        </p>
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
          <div className="mt-2 flex flex-col sm:flex-row gap-5">
            {hasHealthScore && healthResult && (
              <div className="flex flex-col items-start sm:items-center justify-center shrink-0">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" fill="none" r="45" className="stroke-surface-container-high" strokeDasharray="283" strokeDashoffset="0" strokeWidth="8" />
                    <circle
                      className="transition-all duration-1000 ease-out"
                      cx="50" cy="50" fill="none" r="45"
                      stroke={healthResult.score >= 75 ? "var(--primary)" : healthResult.score >= 50 ? "var(--warning)" : "var(--destructive)"}
                      strokeDasharray="283" strokeDashoffset={healthArcOffset} strokeLinecap="round" strokeWidth="8"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary leading-none">{healthResult.score}</span>
                    <span className="text-[9px] text-text-muted mt-0.5">/100</span>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="px-2 py-0.5 border rounded-full text-[10px] font-medium text-primary border-primary/20 bg-primary/10">{healthLabelValue}</span>
                  {healthChange != null && (
                    <span className={`px-2 py-0.5 border rounded-full text-[10px] font-medium ${healthChange > 0 ? "text-primary border-primary/20 bg-primary/10" : "text-destructive border-destructive/25 bg-destructive/5"}`}>
                      {healthChange > 0 ? "+" : ""}{healthChange}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-text-muted/70 leading-tight text-center">{t("healthNotCredit")}</p>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <ul className="space-y-1 max-w-3xl">
                {healthFacts.map((fact, i) => (
                  <li key={i} className="text-sm text-text-muted leading-relaxed flex items-start gap-2">
                    <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${i === 0 ? "bg-primary" : "bg-text-muted/40"}`} />
                    {fact}
                  </li>
                ))}
              </ul>
              {hasHealthScore && weakestFactors.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {weakestFactors.map((f) => (
                    <span key={f.name} className="inline-flex items-center gap-1.5 border border-border bg-surface-container px-2 py-1 rounded-full text-[10px] text-text-secondary">
                      <span className="capitalize font-medium">{f.name.replace(/_/g, " ")}</span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-text-muted">{f.score}/100</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs font-medium text-text-secondary flex items-start gap-1.5 max-w-3xl">
                <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
                {opportunity}
              </p>
              <button
                type="button"
                onClick={() => askFinai(hasHealthScore
                  ? t("healthDraftScore", { score: healthResult?.score ?? 0, label: healthLabelValue })
                  : t("healthDraft", { status: healthLabel, amount: formatCurrency(netCashFlow) }))}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <MessageCircle className="h-3 w-3" />
                {t("askAboutHealth")}
              </button>
            </div>
          </div>
        )}
        <p className="mt-3 text-[10px] uppercase tracking-[0.06em] text-text-muted/60">{t("healthBasis")}</p>
      </div>

      {/* AI BUSINESS INSIGHTS — what happened / why it matters / recommended action */}
      <section className="section-reveal section-reveal-delay-1" aria-label={t("aiInsightsTitle")}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("aiInsightsTitle")}
          </h2>
          <span className="px-2 py-0.5 border border-border rounded-full text-[10px] font-medium text-text-muted bg-surface-card">
            {t("insightsDataBadge")}
          </span>
        </div>

        {monthly.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl hidden sm:block" />
          </div>
        ) : insights.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {insights.map((insight) => {
                const style = INSIGHT_SEVERITY_STYLES[insight.severity];
                const tHeadline = t(insight.headline.key, insight.headline.params ?? {});
                const tWhy = insight.why ? t(insight.why.key, insight.why.params ?? {}) : null;
                const tAction = t(insight.action.key, insight.action.params ?? {});
                return (
                  <article
                    key={insight.id}
                    className={`rounded-xl border p-4 transition-colors ${style.wrap}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <style.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconCls}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        {/* What happened */}
                        <p className="text-sm font-semibold leading-snug text-text-primary">{tHeadline}</p>
                        {/* Why it matters */}
                        {tWhy && (
                          <div className="mt-2 pl-3 border-l-2 border-border">
                            <p className="text-[10px] uppercase tracking-[0.06em] font-semibold text-text-muted">{t("insightsWhyItMatters")}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{tWhy}</p>
                          </div>
                        )}
                        {/* Recommended action */}
                        <div className="mt-2.5 rounded-lg bg-surface-container px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.06em] font-semibold text-text-muted">{t("insightsAction")}</p>
                          <p className="mt-0.5 text-xs font-medium leading-relaxed text-text-primary flex items-start gap-1.5">
                            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden />
                            {tAction}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => askFinai(askInsightDraft(insight, tHeadline, tAction))}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          <MessageCircle className="h-3 w-3" />
                          {t("askInsight")}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-text-muted/70">{t("insightsDisclaimer")}</p>
          </>
        ) : (patterns.data as { patterns?: Array<{ pattern: string; description: string }> } | undefined)?.patterns?.length || monthly.data?.insights?.length ? (
          <div className="rounded-xl border border-border bg-surface-card p-4 space-y-1.5">
            {(patterns.data as { patterns?: Array<{ description: string }> } | undefined)?.patterns?.slice(0, 2)?.map((p, i) => (
              <div key={`p-${i}`} className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <p className="text-xs text-text-muted leading-relaxed flex-1">{p.description}</p>
                <button type="button" onClick={() => askFinai(t("insightDraft", { insight: p.description }))} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline shrink-0">
                  <MessageCircle className="h-2.5 w-2.5" />{t("askInsight")}
                </button>
              </div>
            ))}
            {monthly.data?.insights?.slice(0, 2).map((ins, i) => (
              <div key={`m-${i}`} className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <p className="text-xs text-text-muted leading-relaxed flex-1">{ins}</p>
                <button type="button" onClick={() => askFinai(t("insightDraft", { insight: ins }))} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline shrink-0">
                  <MessageCircle className="h-2.5 w-2.5" />{t("askInsight")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* Intelligent empty state */
          <div className="rounded-xl border border-dashed border-border bg-surface-card/60 p-5 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-primary/50" />
            <p className="mt-2 text-sm font-medium text-text-primary">{t("insightsEmptyTitle")}</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-muted">{t("insightsEmptyDesc")}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Link href={`/${locale}/expenses`} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20">
                <Receipt className="h-3 w-3" />{t("logExpense")}
              </Link>
              <Link href={`/${locale}/expenses`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-container-high">
                <FileText className="h-3 w-3" />{t("importStatementCta")}
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ACTION PLAN — prioritized, bucket-grouped next steps */}
      {hasActionPlan && (
        <section className="section-reveal section-reveal-delay-2" aria-label={t("planTitle")}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-primary" />
              {t("planTitle")}
            </h2>
            <Link href={`/${locale}/recommendations`} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
              {tc("viewAll")} <ArrowRight className="h-3 w-3 icon-hover" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {actionBuckets.filter((b) => b.hasItems).map((bucket) => (
              <div key={bucket.key} className={`rounded-xl border p-4 ${bucket.wrap}`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <bucket.icon className="h-4 w-4 text-text-secondary" aria-hidden />
                  <span className="text-xs font-semibold text-text-primary">{bucket.label}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-text-muted mb-2.5">{bucket.desc}</p>
                <div className="space-y-1.5">
                  {actionPlans[bucket.key].slice(0, 3).map((item, i) => (
                    <div key={i} className="rounded-lg border border-border/70 bg-surface-card/80 p-2.5 action-plan-item">
                      <p className="text-xs font-medium leading-snug text-text-primary">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-text-muted line-clamp-2">{item.reason}</p>
                      <button
                        type="button"
                        onClick={() => askFinai(t("recommendationDraft", { title: item.title }))}
                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                      >
                        <MessageCircle className="h-2.5 w-2.5" />{t("askInsight")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-text-muted/70">{t("planBasis")}</p>
        </section>
      )}

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
          <p className="text-[11px] text-text-muted mt-1">{t("thisMonth")}</p>
        </div>
        <div className="bg-surface-card p-4 stat-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-1">{t("monthlyExpenses")}</p>
          <p className="text-xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
            {monthly.isLoading ? <Skeleton className="h-6 w-24 inline-block" /> : formatCurrency(totalExpenses)}
          </p>
          <p className="text-[11px] text-text-muted mt-1">{t("thisMonth")}</p>
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
            {t("viewAnalysis")} <ArrowRight className="h-3.5 w-3.5 icon-hover" />
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
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("scopeSplitTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {scopeSplit ? (
              <div className="space-y-3">
                {([
                  { key: "business" as const, label: t("scopeBusiness"), amount: scopeSplit.business, cls: "bg-primary" },
                  { key: "personal" as const, label: t("scopePersonal"), amount: scopeSplit.personal, cls: "bg-warning" },
                  ...(scopeSplit.mixed > 0 ? [{ key: "mixed" as const, label: t("scopeMixed"), amount: scopeSplit.mixed, cls: "bg-text-muted/60" }] : []),
                ]).map((row) => (
                  <div key={row.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${row.cls}`} aria-hidden />
                        {row.label}
                      </span>
                      <span className="font-medium font-[family-name:var(--font-jetbrains-mono)] text-text-primary">
                        {formatCurrency(row.amount)}
                        <span className="ml-1.5 text-[10px] text-text-muted">{Math.round((row.amount / scopeSplit.total) * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high" role="presentation">
                      <div
                        className={`h-full rounded-full ${row.cls} transition-all duration-700`}
                        style={{ width: `${Math.max(2, Math.round((row.amount / scopeSplit.total) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-text-muted/70 leading-relaxed pt-1 border-t border-border">
                  {t("scopeSplitBasis", { count: transactionCount })}
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-muted py-4 text-center">{t("scopeSplitEmpty")}</p>
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
                    <button
                      type="button"
                      onClick={() => askFinai(t("recommendationDraft", { title: r.title }))}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                    >
                      <MessageCircle className="h-2.5 w-2.5" />{t("askInsight")}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted py-4 text-center">{tc("noRecommendationsYet")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* LOCAL OPPORTUNITIES — schemes matched to this business & location */}
      {hasBizContext && (
        <section className="section-reveal section-reveal-delay-6" aria-label={t("localOppsTitle")}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-primary" />
              {t("localOppsTitle")}
            </h2>
            <Link href={`/${locale}/schemes`} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
              {t("viewSchemes")} <ExternalLink className="h-3 w-3 icon-hover" />
            </Link>
          </div>
          {localSchemes.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : localSchemes.data?.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {localSchemes.data.slice(0, 3).map((m, i) => (
                <Link
                  key={i}
                  href={`/${locale}/schemes`}
                  className="rounded-xl border border-border bg-surface-card p-4 transition-colors hover:border-primary/30 interactive-card block"
                >
                  <p className="text-xs font-semibold leading-snug text-text-primary line-clamp-2">{m.scheme?.name ?? "—"}</p>
                  <p className="mt-1.5 text-[11px] text-text-muted leading-relaxed line-clamp-2 flex items-start gap-1.5">
                    <CircleHelp className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                    {m.match_reason}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface-card/60 p-4 text-center">
              <p className="text-xs text-text-muted">{t("localOppsEmpty")}</p>
            </div>
          )}
        </section>
      )}

      {/* ASK FINAI CTA */}
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="w-full rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex items-center gap-3 text-left transition-colors hover:border-primary/40 hover:from-primary/15 section-reveal section-reveal-delay-6 cursor-pointer"
      >
        <span className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <MessageCircle className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text-primary">{t("askFinaiBannerTitle")}</span>
          <span className="block text-xs text-text-muted truncate">{t("askFinaiBannerDesc")}</span>
        </span>
        <ArrowRight className="h-4 w-4 text-primary shrink-0" />
      </button>
    </div>
  );
}
