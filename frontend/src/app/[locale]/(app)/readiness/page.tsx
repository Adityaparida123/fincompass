"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/common/shared";
import { useReadiness, useCorrectReadiness } from "@/hooks/use-api";
import { ApiRequestError } from "@/lib/api";
import { useChatStore } from "@/stores/chat-store";
import type { ReadinessFactor, ScoreCorrectionResult } from "@/types";
import { Gauge, ChevronDown, ChevronUp, Info, AlertTriangle, RefreshCw, MessageCircle } from "lucide-react";

function scoreTier(score: number, t: (key: string) => string): { label: string; variant: "success" | "secondary" | "destructive" } {
  if (score >= 80) return { label: t("tierStrong"), variant: "success" };
  if (score >= 60) return { label: t("tierGood"), variant: "success" };
  if (score >= 40) return { label: t("tierFair"), variant: "secondary" };
  return { label: t("tierNeedsWork"), variant: "destructive" };
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

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#14b8a6" : score >= 60 ? "#14b8a6" : score >= 40 ? "#f59e0b" : "#f87171";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--surface-container)" strokeWidth="8" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 60 60)" className="transition-all duration-700" />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold">{score}</p>
        <p className="text-xs text-text-muted">/100</p>
      </div>
    </div>
  );
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
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <CardContent className="pt-6">
          {readiness.isLoading ? (
            <div className="flex justify-center"><Skeleton className="h-36 w-36 rounded-full" /></div>
          ) : readiness.isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium">{t("errorTitle")}</p>
              <p className="text-sm text-text-muted">{t("errorDesc")}</p>
              <Button variant="outline" size="sm" onClick={() => readiness.refetch()}>
                <RefreshCw className="mr-1 h-3 w-3" /> {tc("retry")}
              </Button>
            </div>
          ) : hasInsufficientData ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Gauge className="h-8 w-8 text-text-muted/50" />
              <p className="text-sm font-medium">{t("insufficientTitle")}</p>
              <p className="text-xs text-text-muted max-w-sm">
                {t("insufficientDesc")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
              <ScoreGauge score={score} />
              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm text-text-muted">{readiness.data?.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <Badge variant={tier.variant}>
                    {tier.label}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(t("askDraft", { score: `${score}`, tier: tier.label }));
                      setOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <MessageCircle className="h-3 w-3" />
                    {th("askFinai")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3"><CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("whatChanged")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-xs text-text-muted">{t("previousScore")}</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)]">{result.previous_score}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">{t("newScore")}</p>
                <p className="text-2xl font-bold text-primary font-[family-name:var(--font-jetbrains-mono)]">{result.updated_score}</p>
              </div>
            </div>
            {result.changed_factors.map((f, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="font-medium text-sm">{factorLabel(f.name, tf)}</p>
                <p className="text-xs text-text-muted">{f.explanation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!hasInsufficientData && !readiness.isError && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("factors")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {readiness.isLoading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : readiness.data?.factors.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setSelectedFactor(selectedFactor?.name === f.name ? null : f)}
                className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-surface-container"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{factorLabel(f.name, tf)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.direction === "positive" ? "success" : f.direction === "negative" ? "destructive" : "secondary"} className="text-[10px]">
                      {f.impact > 0 ? "+" : ""}{f.impact}
                    </Badge>
                    {selectedFactor?.name === f.name ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                  </div>
                </div>
                {selectedFactor?.name === f.name && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-text-muted italic">{tf.has(`desc_${FACTOR_LABEL_KEYS[f.name] ?? ""}`) ? tf(`desc_${FACTOR_LABEL_KEYS[f.name]}`) : t("factorGenericDesc")}</p>
                    <p className="text-sm text-text-muted leading-relaxed">{f.explanation}{f.value ? ` (${f.value})` : ""}</p>
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-text-muted" />
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("transparency")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent><p className="text-xs text-text-muted leading-relaxed">{t("transparencyDesc")}</p></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("correctData")}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>{t("somethingWrong")}</Button>
        </CardHeader>
        {showForm && (
          <CardContent>
            <form onSubmit={handleCorrect} className="grid gap-4 sm:grid-cols-2">
              {([
                { key: "income", label: t("fieldIncome") },
                { key: "total_expenses", label: t("fieldTotalExpenses") },
                { key: "essential_monthly_expenses", label: t("fieldEssentialExpenses") },
                { key: "debt_payments", label: t("fieldDebtPayments") },
                { key: "savings", label: t("fieldSavings") },
              ] as const).map((field) => (
                <div key={field.key}><Label>{field.label}</Label>
                  <Input type="number" min="0" value={correction[field.key]} onChange={(e) => setCorrection({ ...correction, [field.key]: e.target.value })} required /></div>
              ))}
              <div className="sm:col-span-2"><Label>{t("fieldReason")}</Label><Textarea value={correction.reason} onChange={(e) => setCorrection({ ...correction, reason: e.target.value })} required /></div>
              <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={correct.isPending}>{tc("save")}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>{tc("cancel")}</Button></div>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
