"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge, Textarea } from "@/components/ui/input";
import { useReadiness, useCorrectReadiness } from "@/hooks/use-api";
import { ApiRequestError } from "@/lib/api";
import type { ReadinessFactor, ScoreCorrectionResult } from "@/types";

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
      <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>

      <Card>
        <CardHeader><CardTitle>{t("score")}</CardTitle></CardHeader>
        <CardContent>
          {readiness.isLoading ? <Skeleton className="h-16 w-32" /> : (
            <>
              <p className="text-5xl font-bold">{score}<span className="text-lg text-muted-foreground">/100</span></p>
              <p className="mt-2 text-muted-foreground">{readiness.data?.summary}</p>
            </>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle>{t("whatChanged")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div><p className="text-muted-foreground">{t("previousScore")}</p><p className="text-2xl font-bold">{result.previous_score}</p></div>
            <div><p className="text-muted-foreground">{t("newScore")}</p><p className="text-2xl font-bold text-primary">{result.updated_score}</p></div>
            {result.changed_factors.map((f, i) => (
              <div key={i} className="w-full rounded-lg border p-3"><p className="font-medium">{f.name}</p><p className="text-xs text-muted-foreground">{f.explanation}</p></div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("factors")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {readiness.isLoading ? <Skeleton className="h-32 w-full" /> : readiness.data?.factors.map((f) => (
            <button key={f.name} type="button" onClick={() => setSelectedFactor(f)} className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{f.name}</span>
                <Badge variant={f.direction === "positive" ? "success" : f.direction === "negative" ? "destructive" : "secondary"}>{f.impact > 0 ? "+" : ""}{f.impact}</Badge>
              </div>
              {selectedFactor?.name === f.name && <p className="mt-2 text-sm text-muted-foreground">{f.explanation}{f.value ? ` (${f.value})` : ""}</p>}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("transparency")}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{t("transparencyDesc")}</p></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("correctData")}</CardTitle>
          <Button variant="outline" onClick={() => setShowForm(!showForm)}>{t("somethingWrong")}</Button>
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
