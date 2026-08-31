"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
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
  ListChecks, Eye, Activity, ShieldCheck, Zap,
} from "lucide-react";
import { FinancialOrb } from "@/components/3d/financial-orb";
import { CreditScore3D } from "@/components/3d/credit-score-3d";
import { AIOrb } from "@/components/3d/ai-orb";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialMetric } from "@/components/spatial/spatial-metric";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

type HealthStatus = "good" | "stable" | "attention" | "nodata";

const INSIGHT_SEVERITY_STYLES: Record<
  BusinessInsight["severity"],
  { wrap: string; iconCls: string; Icon: typeof Lightbulb }
> = {
  critical: { wrap: "border-rose-500/30 bg-rose-500/5 hover:border-rose-400/50", iconCls: "text-rose-400", Icon: AlertTriangle },
  warning: { wrap: "border-amber-500/30 bg-amber-500/5 hover:border-amber-400/50", iconCls: "text-amber-400", Icon: AlertTriangle },
  info: { wrap: "border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400/50", iconCls: "text-cyan-400", Icon: Info },
  positive: { wrap: "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/50", iconCls: "text-emerald-400", Icon: TrendingUp },
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

  // AI Business Health (deterministic, derived only from real data)
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
    { key: "high", label: t("planHigh"), desc: t("planHighDesc"), icon: ListChecks, wrap: "border-rose-500/30 bg-rose-500/5", hasItems: actionPlans.high.length > 0 },
    { key: "medium", label: t("planMedium"), desc: t("planMediumDesc"), icon: Target, wrap: "border-amber-500/30 bg-amber-500/5", hasItems: actionPlans.medium.length > 0 },
    { key: "opportunity", label: t("planOpportunity"), desc: t("planOpportunityDesc"), icon: Lightbulb, wrap: "border-cyan-500/30 bg-cyan-500/5", hasItems: actionPlans.opportunity.length > 0 },
    { key: "monitor", label: t("planMonitor"), desc: t("planMonitorDesc"), icon: Eye, wrap: "border-slate-500/30 bg-slate-500/5", hasItems: actionPlans.monitor.length > 0 },
  ];
  const hasActionPlan = Object.values(actionPlans).some((items) => items.length > 0);

  const healthResult = healthQuery.data;
  const hasHealthScore = !healthResult?.insufficient_data && (healthResult?.score != null);
  const healthLabelValue =
    healthResult?.label === "Good" ? t("healthScoreGood")
      : healthResult?.label === "Moderate" ? t("healthScoreModerate")
        : healthResult?.label === "Needs attention" ? t("healthScoreAttention")
          : t("healthNoData");
  const healthChange = healthResult?.change;
  const weakestFactors = [...(healthResult?.factors ?? [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const scoreProgress = Math.min(100, Math.max(0, score));
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

  const healthLabel =
    health === "good" ? t("healthGood")
      : health === "stable" ? t("healthStable")
        : health === "attention" ? t("healthAttention")
          : t("healthNoData");

  return (
    <div className="space-y-6 page-transition">
      {/* Top Command Center Header */}
      <div className="relative rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-surface-card/90 via-surface-card/70 to-cyan-950/25 p-5 md:p-6 backdrop-blur-2xl overflow-hidden hud-corner shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <SpatialBadge variant="cyan" pulse icon={<Zap className="h-3 w-3" />}>
                TELEMETRY LIVE
              </SpatialBadge>
              {bizContextLine && (
                <SpatialBadge variant="indigo" icon={<Store className="h-3 w-3" />}>
                  {bizContextLine}
                </SpatialBadge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary mt-1" suppressHydrationWarning>
              {displayName ? t("greetingWithName", { greeting, name: displayName }) : greeting}
            </h1>
            <p className="text-xs text-text-muted flex items-center gap-2">
              <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
              <span>·</span>
              <span className="text-cyan-400 font-mono">IST LIVE</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setChatOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs transition-all duration-200 shadow-[0_0_20px_rgba(0,242,254,0.35)] cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>CONSULT FINAI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Flagship AI Business Health — 3D Command Orb & Diagnostics */}
      <GlassPanel glow="cyan" hudCorners className="relative overflow-hidden p-6">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Left: 3D Interactive Health Orb */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="relative">
              <FinancialOrb status={health} score={healthResult?.score} size={190} />
              {hasHealthScore && healthResult && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-3xl font-bold font-mono text-cyan-300 drop-shadow-[0_0_10px_rgba(0,242,254,0.6)]">
                    {healthResult.score}
                  </span>
                  <span className="text-[10px] uppercase font-mono text-text-muted">/100 HEALTH</span>
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <SpatialBadge
                variant={health === "good" ? "emerald" : health === "stable" ? "amber" : health === "attention" ? "rose" : "muted"}
                pulse
              >
                {healthLabel}
              </SpatialBadge>
              {healthChange != null && (
                <span className={`px-2 py-0.5 border rounded-full text-[10px] font-mono font-semibold ${healthChange > 0 ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" : "text-rose-300 border-rose-500/30 bg-rose-500/10"}`}>
                  {healthChange > 0 ? "+" : ""}{healthChange} pts
                </span>
              )}
            </div>
          </div>

          {/* Right: AI Health Diagnostics & Strategic Opportunity */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span>AI Health Diagnostics</span>
              </h2>
              <span className="text-[10px] font-mono uppercase text-text-muted">Deterministic Core</span>
            </div>

            {health === "nodata" ? (
              <p className="text-sm text-text-secondary leading-relaxed">{t("healthNoDataDesc")}</p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {healthFacts.map((fact, i) => (
                    <li key={i} className="text-xs text-text-secondary leading-relaxed flex items-start gap-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${i === 0 ? "bg-cyan-400 shadow-[0_0_6px_#00f2fe]" : "bg-text-muted"}`} />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>

                {hasHealthScore && weakestFactors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {weakestFactors.map((f) => (
                      <span key={f.name} className="inline-flex items-center gap-1.5 border border-cyan-500/20 bg-surface-container/80 px-2.5 py-1 rounded-lg text-[10px] text-text-secondary">
                        <span className="capitalize font-medium text-text-primary">{f.name.replace(/_/g, " ")}</span>
                        <span className="font-mono text-cyan-300 font-semibold">{f.score}/100</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 flex items-start gap-2.5">
                  <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Tactical Recommendation</p>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{opportunity}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => askFinai(hasHealthScore
                    ? t("healthDraftScore", { score: healthResult?.score ?? 0, label: healthLabelValue })
                    : t("healthDraft", { status: healthLabel, amount: formatCurrency(netCashFlow) }))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 hover:border-cyan-400/50 cursor-pointer shadow-[0_0_12px_rgba(0,242,254,0.12)]"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{t("askAboutHealth")}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* Spatial Financial Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {todaysSales != null && (
          <SpatialMetric
            label={t("todaysSales")}
            value={formatCurrency(todaysSales)}
            subtitle={format(new Date(), "d MMMM")}
            loading={monthly.isLoading}
            glow="cyan"
            icon={TrendingUp}
          />
        )}
        <SpatialMetric
          label={t("monthlyRevenue")}
          value={formatCurrency(totalIncome)}
          subtitle={t("thisMonth")}
          loading={monthly.isLoading}
          glow="cyan"
          icon={TrendingUp}
        />
        <SpatialMetric
          label={t("monthlyExpenses")}
          value={formatCurrency(totalExpenses)}
          subtitle={t("thisMonth")}
          loading={monthly.isLoading}
          glow="indigo"
          icon={Receipt}
        />
        <SpatialMetric
          label={t("estimatedProfit")}
          value={formatCurrency(netCashFlow)}
          subtitle={netCashFlow >= 0 ? t("profitPositive") : t("profitNegative")}
          loading={monthly.isLoading}
          glow={netCashFlow >= 0 ? "emerald" : "rose"}
          trend={netCashFlow >= 0 ? "up" : "down"}
          trendValue={changePercent != null ? `${changePercent > 0 ? "+" : ""}${changePercent}%` : undefined}
          icon={Wallet}
        />
      </div>

      {/* Capital & Liquidity Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href={`/${locale}/savings`} className="block">
          <GlassPanel glow="cyan" className="p-4 transition-transform hover:-translate-y-1">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-cyan-400" />
                {t("availableCash")}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-cyan-400/60" />
            </div>
            <p className="text-xl font-bold font-mono text-text-primary tabular-nums mt-1">
              {savings.isLoading ? <Skeleton className="h-6 w-24" /> : formatCurrency(totalSavings + Math.max(netCashFlow, 0))}
            </p>
            <p className="text-xs text-text-muted mt-1">{t("availableCashDesc")}</p>
          </GlassPanel>
        </Link>

        <Link href={`/${locale}/debt`} className="block">
          <GlassPanel glow="rose" className="p-4 transition-transform hover:-translate-y-1">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-rose-400" />
                {t("upcomingPayments")}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-rose-400/60" />
            </div>
            <p className="text-xl font-bold font-mono text-text-primary tabular-nums mt-1">
              {debts.isLoading ? <Skeleton className="h-6 w-24" /> : formatCurrency(monthlyDebtPayments)}
            </p>
            <p className="text-xs text-text-muted mt-1">{debts.data?.length ?? 0} active debts</p>
          </GlassPanel>
        </Link>

        <Link href={`/${locale}/savings`} className="block">
          <GlassPanel glow="emerald" className="p-4 transition-transform hover:-translate-y-1">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-emerald-400" />
                {t("savingsBalance")}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-emerald-400/60" />
            </div>
            <p className="text-xl font-bold font-mono text-text-primary tabular-nums mt-1">
              {savings.isLoading ? <Skeleton className="h-6 w-24" /> : formatCurrency(totalSavings)}
            </p>
            <p className="text-xs text-text-muted mt-1">{t("savingsBalanceDesc")}</p>
          </GlassPanel>
        </Link>
      </div>

      {/* AI Business Insights Matrix */}
      <section aria-label={t("aiInsightsTitle")}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>{t("aiInsightsTitle")}</span>
          </h2>
          <SpatialBadge variant="cyan">{t("insightsDataBadge")}</SpatialBadge>
        </div>

        {monthly.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl hidden sm:block" />
          </div>
        ) : insights.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {insights.map((insight) => {
              const style = INSIGHT_SEVERITY_STYLES[insight.severity];
              const tHeadline = t(insight.headline.key, insight.headline.params ?? {});
              const tWhy = insight.why ? t(insight.why.key, insight.why.params ?? {}) : null;
              const tAction = t(insight.action.key, insight.action.params ?? {});
              return (
                <GlassPanel
                  key={insight.id}
                  className={`border transition-all duration-200 ${style.wrap}`}
                >
                  <div className="flex items-start gap-3">
                    <style.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconCls}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary leading-snug">{tHeadline}</p>
                      {tWhy && (
                        <div className="mt-2 pl-3 border-l border-cyan-500/30">
                          <p className="text-[10px] uppercase font-semibold text-text-muted">{t("insightsWhyItMatters")}</p>
                          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{tWhy}</p>
                        </div>
                      )}
                      <div className="mt-2.5 rounded-xl bg-surface-container/80 p-2.5 border border-white/5">
                        <p className="text-[10px] uppercase font-semibold text-text-muted">{t("insightsAction")}</p>
                        <p className="text-xs font-medium text-text-primary mt-0.5 flex items-start gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
                          <span>{tAction}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => askFinai(askInsightDraft(insight, tHeadline, tAction))}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>{t("askInsight")}</span>
                      </button>
                    </div>
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        ) : (
          <GlassPanel className="p-6 text-center border-dashed border-cyan-500/25">
            <Sparkles className="mx-auto h-6 w-6 text-cyan-400" />
            <p className="mt-2 text-sm font-semibold text-text-primary">{t("insightsEmptyTitle")}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">{t("insightsEmptyDesc")}</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link href={`/${locale}/expenses`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                <Receipt className="h-3.5 w-3.5" />
                <span>{t("logExpense")}</span>
              </Link>
            </div>
          </GlassPanel>
        )}
      </section>

      {/* Action Plan Section */}
      {hasActionPlan && (
        <section aria-label={t("planTitle")}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-cyan-400" />
              <span>{t("planTitle")}</span>
            </h2>
            <Link href={`/${locale}/recommendations`} className="flex items-center gap-1 text-xs text-cyan-400 hover:underline">
              {tc("viewAll")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {actionBuckets.filter((b) => b.hasItems).map((bucket) => (
              <GlassPanel key={bucket.key} className={`border ${bucket.wrap}`}>
                <div className="flex items-center gap-2 mb-2">
                  <bucket.icon className="h-4 w-4 text-text-secondary" aria-hidden />
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider">{bucket.label}</span>
                </div>
                <p className="text-[11px] text-text-muted mb-3 leading-relaxed">{bucket.desc}</p>
                <div className="space-y-2">
                  {actionPlans[bucket.key].slice(0, 3).map((item, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-surface-card/90 p-2.5">
                      <p className="text-xs font-semibold text-text-primary">{item.title}</p>
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{item.reason}</p>
                      <button
                        type="button"
                        onClick={() => askFinai(t("recommendationDraft", { title: item.title }))}
                        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-400 hover:underline"
                      >
                        <MessageCircle className="h-2.5 w-2.5" />
                        <span>{t("askInsight")}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            ))}
          </div>
        </section>
      )}

      {/* Bento Grid: 3D Credit Readiness, Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 3D Credit Readiness Gauge */}
        <GlassPanel glow="cyan" hudCorners className="lg:col-span-4 flex flex-col justify-between p-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{tc("businessCredit")}</h4>
            <Info className="h-3.5 w-3.5 text-text-muted" />
          </div>

          <div className="my-3 flex flex-col items-center justify-center">
            {readiness.isLoading ? (
              <Skeleton className="w-32 h-32 rounded-full" />
            ) : (
              <div className="relative">
                <CreditScore3D score={score} size={150} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold font-mono text-text-primary">{score}</span>
                  <span className="text-[10px] uppercase font-mono text-cyan-400">/100</span>
                </div>
              </div>
            )}
            <SpatialBadge variant={score >= 70 ? "emerald" : score >= 45 ? "amber" : "rose"} className="mt-2">
              {scoreStatus}
            </SpatialBadge>
          </div>

          <Link
            href={`/${locale}/readiness`}
            className="w-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold py-2 rounded-xl hover:bg-cyan-500/25 transition-all text-xs flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,242,254,0.1)]"
          >
            <span>{t("viewAnalysis")}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </GlassPanel>

        {/* Recent Activity */}
        <GlassPanel className="lg:col-span-5 flex flex-col justify-between p-5">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{tc("recentActivity")}</h4>
            <Link href={`/${locale}/expenses`} className="text-xs text-cyan-400 font-medium hover:underline">
              {tc("viewAll")}
            </Link>
          </div>

          <div className="space-y-2 my-2">
            {trends.isLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
            ) : trendData.length > 0 ? (
              trendData.slice(0, 3).map((item, idx) => {
                const isIncome = item.income > item.expenses;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-white/5 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isIncome ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"}`}>
                      {isIncome ? <TrendingUp className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">
                        {isIncome ? tc("income") : tc("expense")} — {item.period}
                      </p>
                      <p className="text-[10px] text-text-muted">{isIncome ? tc("received") : tc("tracked")}</p>
                    </div>
                    <span className={`text-xs font-mono font-bold shrink-0 ${isIncome ? "text-emerald-400" : "text-text-primary"}`}>
                      {isIncome ? "+" : "-"}{formatCurrency(isIncome ? item.income : item.expenses)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-text-muted">
                <Receipt className="mx-auto mb-2 h-6 w-6 text-text-muted/40" />
                <p>{tc("noRecentActivity")}</p>
              </div>
            )}
          </div>

          <p className="text-[10px] font-mono text-text-muted text-right">Realtime Ledger Sync</p>
        </GlassPanel>

        {/* Quick Actions */}
        <div className="lg:col-span-3 space-y-2 flex flex-col justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">{t("quickActions")}</h4>
          {quickActions.map((action) => {
            const inner = (
              <>
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform shrink-0">
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-primary group-hover:text-cyan-300 transition-colors">{action.label}</p>
                  <p className="text-[10px] text-text-muted truncate">{action.desc}</p>
                </div>
              </>
            );
            const cls = "w-full rounded-xl border border-cyan-500/20 bg-surface-card/85 p-3 flex items-center gap-3 hover:border-cyan-400/40 hover:bg-cyan-950/20 transition-all group text-left cursor-pointer";
            return action.href ? (
              <Link key={action.label} href={action.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <button key={action.label} type="button" onClick={action.onClick} className={cls}>
                {inner}
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("incomeVsExpenses")}
          subtitle="Monthly income vs expenses trend"
          badge={<SpatialBadge variant="cyan">6 MONTH TRAJECTORY</SpatialBadge>}
        >
          {trends.isLoading ? (
            <ChartSkeleton variant="area" />
          ) : trends.isError ? (
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
          action={
            <Link href={`/${locale}/budget`} className="flex items-center gap-1 text-xs text-cyan-400 hover:underline">
              {tc("viewAll")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {budget.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full rounded-xl" />)}
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
              <Link href={`/${locale}/budget`} className="mt-1 text-xs text-cyan-400 hover:underline">
                {tc("createBudget")}
              </Link>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Tactical Insights Bento Row: Forecast, Expense Scope, AI Recommendations */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ML Forecast Card */}
        <GlassPanel glow="cyan" className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("forecast")}</span>
              <SpatialBadge variant="cyan">{tc("forecastDisclaimer")}</SpatialBadge>
            </div>
            <div className="mt-3">
              {forecast.isLoading ? (
                <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-full" /></div>
              ) : forecast.isError ? (
                <PageError message={t("forecastError")} onRetry={() => forecast.refetch()} />
              ) : isInsufficientData ? (
                <div className="space-y-1.5 text-xs text-text-muted">
                  <p className="font-semibold text-text-primary">{t("forecastInsufficient")}</p>
                  <p>{t("forecastInsufficientDesc")}</p>
                </div>
              ) : forecast.data?.expense_forecast || forecast.data?.income_forecast ? (
                <div className="space-y-2">
                  {forecast.data.expense_forecast && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{t("expectedExpenses")}</span>
                      <span className="font-mono font-bold text-text-primary">{formatCurrency(forecast.data.expense_forecast.predicted)}</span>
                    </div>
                  )}
                  {forecast.data.income_forecast && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{t("expectedIncome")}</span>
                      <span className="font-mono font-bold text-text-primary">{formatCurrency(forecast.data.income_forecast.predicted)}</span>
                    </div>
                  )}
                  {forecast.data.expense_forecast && forecast.data.income_forecast && (
                    <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                      <span className="text-text-muted">{t("expectedSurplus")}</span>
                      <span className={`font-mono font-bold ${(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {formatCurrency(forecast.data.income_forecast.predicted - forecast.data.expense_forecast.predicted)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-muted">{tc("noData")}</p>
              )}
            </div>
          </div>
          <Link href={`/${locale}/cashflow`} className="mt-3 flex items-center gap-1 text-xs text-cyan-400 font-semibold hover:underline">
            <span>{t("viewForecast")}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </GlassPanel>

        {/* Scope Split */}
        <GlassPanel className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">{t("scopeSplitTitle")}</span>
              <SpatialBadge variant="indigo">CLASSIFIER</SpatialBadge>
            </div>
            <div className="mt-3">
              {scopeSplit ? (
                <div className="space-y-3">
                  {([
                    { key: "business" as const, label: t("scopeBusiness"), amount: scopeSplit.business, cls: "bg-cyan-400", shadow: "shadow-[0_0_8px_#00f2fe]" },
                    { key: "personal" as const, label: t("scopePersonal"), amount: scopeSplit.personal, cls: "bg-amber-400", shadow: "shadow-[0_0_8px_#fbbf24]" },
                    ...(scopeSplit.mixed > 0 ? [{ key: "mixed" as const, label: t("scopeMixed"), amount: scopeSplit.mixed, cls: "bg-slate-400", shadow: "" }] : []),
                  ]).map((row) => (
                    <div key={row.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-text-muted flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${row.cls} ${row.shadow}`} />
                          {row.label}
                        </span>
                        <span className="font-mono font-bold text-text-primary">
                          {formatCurrency(row.amount)}
                          <span className="ml-1 text-[10px] text-text-muted font-normal">({Math.round((row.amount / scopeSplit.total) * 100)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-container overflow-hidden">
                        <div
                          className={`h-full rounded-full ${row.cls}`}
                          style={{ width: `${Math.max(3, Math.round((row.amount / scopeSplit.total) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted py-4 text-center">{t("scopeSplitEmpty")}</p>
              )}
            </div>
          </div>
          <p className="text-[10px] font-mono text-text-muted mt-3">{t("scopeSplitBasis", { count: transactionCount })}</p>
        </GlassPanel>

        {/* AI Recommendations */}
        <GlassPanel glow="emerald" className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">{tc("aiRecommendations")}</span>
              <Link href={`/${locale}/recommendations`} className="text-xs text-emerald-400 hover:underline">
                {tc("viewAll")}
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {recommendations.isLoading ? (
                <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : recommendations.isError ? (
                <PageError message={recommendations.error instanceof Error ? recommendations.error.message : tc("error")} onRetry={() => recommendations.refetch()} />
              ) : recommendations.data?.recommendations?.length ? (
                recommendations.data.recommendations.slice(0, 3).map((r, i) => (
                  <div key={i} className="rounded-xl border border-white/5 bg-surface-card/90 p-2.5 hover:border-emerald-500/30 transition-colors">
                    <p className="text-xs font-semibold text-text-primary leading-snug">{r.title}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted line-clamp-2">{r.reason}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-text-muted py-4 text-center">{tc("noRecommendationsYet")}</p>
              )}
            </div>
          </div>
          <Link href={`/${locale}/recommendations`} className="mt-3 flex items-center gap-1 text-xs text-emerald-400 font-semibold hover:underline">
            <span>{tc("viewAll")}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </GlassPanel>
      </div>

      {/* Local Government Schemes & Institutional Discovery */}
      {hasBizContext && (
        <section aria-label={t("localOppsTitle")}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-cyan-400" />
              <span>{t("localOppsTitle")}</span>
            </h2>
            <Link href={`/${locale}/schemes`} className="flex items-center gap-1 text-xs text-cyan-400 hover:underline">
              {t("viewSchemes")} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          {localSchemes.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : localSchemes.data?.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {localSchemes.data.slice(0, 3).map((m, i) => (
                <Link key={i} href={`/${locale}/schemes`} className="block">
                  <GlassPanel glow="cyan" className="p-4 transition-transform hover:-translate-y-1">
                    <p className="text-xs font-bold text-text-primary line-clamp-2">{m.scheme?.name ?? "—"}</p>
                    <p className="mt-1.5 text-[11px] text-text-muted leading-relaxed line-clamp-2 flex items-start gap-1.5">
                      <CircleHelp className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
                      <span>{m.match_reason}</span>
                    </p>
                  </GlassPanel>
                </Link>
              ))}
            </div>
          ) : (
            <GlassPanel className="p-4 text-center border-dashed border-cyan-500/20">
              <p className="text-xs text-text-muted">{t("localOppsEmpty")}</p>
            </GlassPanel>
          )}
        </section>
      )}

      {/* FinAI Neural Copilot Interactive Command Banner */}
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="w-full relative overflow-hidden rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-950/40 via-surface-card/90 to-indigo-950/40 p-5 flex items-center justify-between text-left transition-all hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(0,242,254,0.2)] cursor-pointer group"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <AIOrb size={48} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-cyan-300 group-hover:text-cyan-200 transition-colors flex items-center gap-2">
              <span>{t("askFinaiBannerTitle")}</span>
              <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
            </p>
            <p className="text-xs text-text-secondary truncate mt-0.5">{t("askFinaiBannerDesc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold uppercase tracking-wider group-hover:bg-cyan-500/30 transition-colors shrink-0">
          <span>CONSULT NOW</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </button>
    </div>
  );
}
