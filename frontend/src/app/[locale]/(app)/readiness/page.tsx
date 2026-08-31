"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Textarea } from "@/components/ui/input";
import { useReadiness, useCorrectReadiness } from "@/hooks/use-api";
import { ApiRequestError } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";
import type { ReadinessFactor, ScoreCorrectionResult } from "@/types";
import { ChevronDown, ChevronUp, Info, AlertTriangle, RefreshCw, MessageCircle, ShieldCheck, Sparkles, Sliders } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";
import { CreditScore3D } from "@/components/3d/credit-score-3d";

function scoreTier(score: number, t: (key: string) => string): { label: string; variant: "cyan" | "emerald" | "amber" | "rose" } {
  if (score >= 80) return { label: t("tierStrong"), variant: "emerald" };
  if (score >= 60) return { label: t("tierGood"), variant: "cyan" };
  if (score >= 40) return { label: t("tierFair"), variant: "amber" };
  return { label: t("tierNeedsWork"), variant: "rose" };
}

const FACTOR_LABEL_KEYS: Record<string, string> = {
  cash_flow_stability: "cashFlowStability",
  income_consistency: "incomeConsistency",
  savings_capacity: "savingsCapacity",
  emergency_buffer: "emergencyBuffer",
  existing_debt_burden: "debtBurden",
  repayment_affordability: "repaymentAffordability",
  expense_volatility: "expenseVolatility",
};

function factorLabel(name: string, t: (key: string) => string): string {
  const key = FACTOR_LABEL_KEYS[name];
  if (key) return t(key);
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ReadinessPage() {
  const t = useTranslations("readiness");
  const tf = useTranslations("readiness.factorLabels");
  const tc = useTranslations("common");
  const th = useTranslations("home");
  const [selectedFactor, setSelectedFactor] = useState<ReadinessFactor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [correction, setCorrection] = useState({ income: "", total_expenses: "", essential_monthly_expenses: "", debt_payments: "", savings: "", reason: "" });
  const [result, setResult] = useState<ScoreCorrectionResult | null>(null);
  const [error, setError] = useState("");

  const readiness = useReadiness();
  const correct = useCorrectReadiness();
  const { setOpen, setDraft } = useChatStore();

  const handleCorrect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await correct.mutateAsync({
        income: parseFloat(correction.income),
        total_expenses: parseFloat(correction.total_expenses),
        essential_monthly_expenses: parseFloat(correction.essential_monthly_expenses),
        debt_payments: parseFloat(correction.debt_payments),
        savings: parseFloat(correction.savings),
        reason: correction.reason,
      });
      setResult(res);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  const score = readiness.data?.score ?? 0;
  const hasInsufficientData = readiness.data?.insufficient_data ?? false;
  const tier = scoreTier(score, t);

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="AI CREDIT READINESS"
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant={tier.variant} pulse>
              TIER: {tier.label.toUpperCase()}
            </SpatialBadge>
          </div>
        }
      />

      {/* Main 3D Gauge & Summary Hero */}
      <GlassPanel glow={tier.variant === "emerald" ? "emerald" : "cyan"} hudCorners className="p-6 md:p-8">
        {readiness.isLoading ? (
          <div className="flex justify-center py-8"><Skeleton className="h-44 w-44 rounded-full" /></div>
        ) : readiness.isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
            <p className="text-sm font-semibold text-rose-300">{t("errorTitle")}</p>
            <p className="text-xs text-text-muted">{t("errorDesc")}</p>
            <Button variant="outline" size="sm" onClick={() => readiness.refetch()} className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {tc("retry")}
            </Button>
          </div>
        ) : hasInsufficientData ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ShieldCheck className="h-10 w-10 text-cyan-400/40" />
            <p className="text-sm font-semibold text-text-primary">{t("insufficientTitle")}</p>
            <p className="text-xs text-text-muted max-w-md">
              {t("insufficientDesc")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex flex-col items-center">
              <CreditScore3D score={score} size={220} />
            </div>

            <div className="flex-1 space-y-4 text-center lg:text-left">
              <div>
                <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                  <SpatialBadge variant={tier.variant}>{tier.label}</SpatialBadge>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">Real-Time Underwriting Metric</span>
                </div>
                <p className="text-sm md:text-base text-text-secondary leading-relaxed max-w-2xl">{readiness.data?.summary}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 justify-center lg:justify-start pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(t("askDraft", { score: `${score}`, tier: tier.label }));
                    setOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-mono font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(0,242,254,0.2)]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{th("askFinai")}</span>
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(!showForm)}
                  className="border-white/10 text-xs font-mono text-text-secondary hover:bg-surface-container"
                >
                  <Sliders className="h-3.5 w-3.5 mr-1.5" />
                  {t("somethingWrong")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Recalibration Result Panel */}
      {result && (
        <GlassPanel glow="cyan" hudCorners className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>{t("whatChanged")}</span>
            </h3>
            <SpatialBadge variant="cyan">UPDATED</SpatialBadge>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-surface-container border border-white/5">
                <p className="text-xs text-text-muted">{t("previousScore")}</p>
                <p className="text-2xl font-mono font-bold text-text-secondary">{result.previous_score}</p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                <p className="text-xs text-cyan-300">{t("newScore")}</p>
                <p className="text-2xl font-mono font-bold text-cyan-400">{result.updated_score}</p>
              </div>
            </div>
            <div className="grid gap-2">
              {result.changed_factors.map((f, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-surface-container/60 p-3">
                  <p className="font-semibold text-xs text-text-primary">{factorLabel(f.name, tf)}</p>
                  <p className="text-xs text-text-muted mt-0.5">{f.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Factors Accordion Grid */}
      {!hasInsufficientData && !readiness.isError && (
        <GlassPanel className="p-6 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{t("factors")}</h3>
            <span className="text-[11px] font-mono text-text-muted">7 MULTIVARIATE PARAMETERS</span>
          </div>

          <div className="space-y-2.5 pt-2">
            {readiness.isLoading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
            ) : readiness.data?.factors.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setSelectedFactor(selectedFactor?.name === f.name ? null : f)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  selectedFactor?.name === f.name
                    ? "border-cyan-500/40 bg-cyan-500/5 shadow-[0_0_15px_rgba(0,242,254,0.05)]"
                    : "border-white/5 bg-surface-container/60 hover:bg-surface-container hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`h-2 w-2 rounded-full ${f.direction === "positive" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : f.direction === "negative" ? "bg-rose-400 shadow-[0_0_8px_#f87171]" : "bg-amber-400"}`} />
                    <span className="font-medium text-sm text-text-primary">{factorLabel(f.name, tf)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <SpatialBadge variant={f.direction === "positive" ? "emerald" : f.direction === "negative" ? "rose" : "amber"}>
                      {f.impact > 0 ? "+" : ""}{f.impact} PTS
                    </SpatialBadge>
                    {selectedFactor?.name === f.name ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                  </div>
                </div>
                {selectedFactor?.name === f.name && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 animate-fadeIn">
                    <p className="text-xs text-text-muted italic">{tf.has(`desc_${FACTOR_LABEL_KEYS[f.name] ?? ""}`) ? tf(`desc_${FACTOR_LABEL_KEYS[f.name]}`) : t("factorGenericDesc")}</p>
                    <p className="text-xs text-cyan-200/90 leading-relaxed font-mono">{f.explanation}{f.value ? ` (${f.value})` : ""}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Manual Recalibration Dialog */}
      {showForm && (
        <GlassPanel glow="cyan" hudCorners className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("correctData")}</h3>
            <span className="text-[11px] font-mono text-text-muted">MANUAL OVERRIDE</span>
          </div>
          <form onSubmit={handleCorrect} className="grid gap-4 sm:grid-cols-2">
            {([
              { key: "income", label: t("fieldIncome") },
              { key: "total_expenses", label: t("fieldTotalExpenses") },
              { key: "essential_monthly_expenses", label: t("fieldEssentialExpenses") },
              { key: "debt_payments", label: t("fieldDebtPayments") },
              { key: "savings", label: t("fieldSavings") },
            ] as const).map((field) => (
              <div key={field.key}>
                <Label className="text-xs text-text-secondary">{field.label}</Label>
                <Input
                  type="number"
                  min="0"
                  className="mt-1 bg-surface-container border-cyan-500/20 font-mono"
                  value={correction[field.key]}
                  onChange={(e) => setCorrection({ ...correction, [field.key]: e.target.value })}
                  required
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Label className="text-xs text-text-secondary">{t("fieldReason")}</Label>
              <Textarea
                rows={2}
                className="mt-1 bg-surface-container border-cyan-500/20"
                value={correction.reason}
                onChange={(e) => setCorrection({ ...correction, reason: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-3 sm:col-span-2 pt-2">
              <Button type="submit" disabled={correct.isPending} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6">
                {correct.isPending ? "COMPUTING..." : tc("save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-text-secondary">
                {tc("cancel")}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-xs font-mono text-rose-400">{error}</p>}
        </GlassPanel>
      )}

      {/* Algorithmic Transparency Panel */}
      <GlassPanel className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-cyan-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">{t("transparency")}</h4>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">{t("transparencyDesc")}</p>
      </GlassPanel>
    </div>
  );
}
