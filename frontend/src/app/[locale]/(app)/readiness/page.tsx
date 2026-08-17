"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/common/shared";
import { useReadiness, useCorrectReadiness } from "@/hooks/use-api";
import { ApiRequestError } from "@/lib/api";
import type { ReadinessFactor, ScoreCorrectionResult } from "@/types";
import { Gauge, ChevronDown, ChevronUp, Info } from "lucide-react";

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#14b8a6" : score >= 40 ? "#f59e0b" : "#f87171";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--muted)" strokeWidth="8" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 60 60)" className="transition-all duration-700" />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold">{score}</p>
        <p className="text-xs text-muted-foreground">/100</p>
      </div>
    </div>
  );
}

export default function ReadinessPage() {
  const t = useTranslations("readiness");
  const tc = useTranslations("common");
  const [selectedFactor, setSelectedFactor] = useState<ReadinessFactor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [correction, setCorrection] = useState({ income: "", total_expenses: "", essential_monthly_expenses: "", debt_payments: "", savings: "", reason: "" });
  const [result, setResult] = useState<ScoreCorrectionResult | null>(null);
  const [error, setError] = useState("");

  const readiness = useReadiness();
  const correct = useCorrectReadiness();

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

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle="Understand your credit readiness based on your financial data." />

      <Card>
        <CardContent className="pt-6">
          {readiness.isLoading ? (
            <div className="flex justify-center"><Skeleton className="h-36 w-36 rounded-full" /></div>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
              <ScoreGauge score={score} />
              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm text-muted-foreground">{readiness.data?.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <Badge variant={score >= 70 ? "success" : score >= 40 ? "secondary" : "destructive"}>
                    {score >= 70 ? "Good" : score >= 40 ? "Fair" : "Needs improvement"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">{t("whatChanged")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("previousScore")}</p>
                <p className="text-2xl font-bold">{result.previous_score}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("newScore")}</p>
                <p className="text-2xl font-bold text-primary">{result.updated_score}</p>
              </div>
            </div>
            {result.changed_factors.map((f, i) => (
              <div key={i} className="rounded-lg border border-muted/50 p-3">
                <p className="font-medium text-sm">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.explanation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">{t("factors")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {readiness.isLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : readiness.data?.factors.map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => setSelectedFactor(selectedFactor?.name === f.name ? null : f)}
              className="w-full rounded-lg border border-muted/50 p-3 text-left transition-colors hover:bg-muted/20"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{f.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={f.direction === "positive" ? "success" : f.direction === "negative" ? "destructive" : "secondary"} className="text-[10px]">
                    {f.impact > 0 ? "+" : ""}{f.impact}
                  </Badge>
                  {selectedFactor?.name === f.name ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              {selectedFactor?.name === f.name && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.explanation}{f.value ? ` (${f.value})` : ""}</p>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{t("transparency")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent><p className="text-xs text-muted-foreground leading-relaxed">{t("transparencyDesc")}</p></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
          <CardTitle className="text-sm font-medium">{t("correctData")}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>{t("somethingWrong")}</Button>
        </CardHeader>
        {showForm && (
          <CardContent>
            <form onSubmit={handleCorrect} className="grid gap-4 sm:grid-cols-2">
              {(["income", "total_expenses", "essential_monthly_expenses", "debt_payments", "savings"] as const).map((field) => (
                <div key={field}><Label>{field.replace(/_/g, " ")}</Label>
                  <Input type="number" min="0" value={correction[field]} onChange={(e) => setCorrection({ ...correction, [field]: e.target.value })} required /></div>
              ))}
              <div className="sm:col-span-2"><Label>Reason</Label><Textarea value={correction.reason} onChange={(e) => setCorrection({ ...correction, reason: e.target.value })} required /></div>
              <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={correct.isPending}>{tc("save")}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>{tc("cancel")}</Button></div>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
