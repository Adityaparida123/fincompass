"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { PageHeader } from "@/components/common/shared";
import { useCalculateEMI, useLoanSimulation } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import type { EMIResult, LoanSimulationResult } from "@/types";
import { Calculator, Play, AlertTriangle, CheckCircle, XCircle, HandCoins } from "lucide-react";

export default function BorrowingPage() {
  const t = useTranslations("borrowing");
  const tc = useTranslations("common");
  const [form, setForm] = useState({ principal: "", interest_rate: "", tenure_months: "12", income: "", monthly_expenses: "", existing_debt_payment: "0" });
  const [emiResult, setEmiResult] = useState<EMIResult | null>(null);
  const [simResult, setSimResult] = useState<LoanSimulationResult | null>(null);
  const [error, setError] = useState("");

  const calcEmi = useCalculateEMI();
  const simulate = useLoanSimulation();

  const handleEmi = async () => {
    setError("");
    try {
      const res = await calcEmi.mutateAsync({
        principal: parseFloat(form.principal),
        annual_interest_rate: parseFloat(form.interest_rate),
        tenure_months: parseInt(form.tenure_months, 10),
      });
      setEmiResult(res);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  const handleSimulate = async () => {
    setError("");
    try {
      const res = await simulate.mutateAsync({
        income: parseFloat(form.income),
        monthly_expenses: parseFloat(form.monthly_expenses),
        existing_debt_payment: parseFloat(form.existing_debt_payment || "0"),
        loan_amount: parseFloat(form.principal),
        interest_rate: parseFloat(form.interest_rate),
        tenure_months: parseInt(form.tenure_months, 10),
      });
      setSimResult(res);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  const alternatives = simResult?.alternatives ?? [];
  const altItems = alternatives.map((a) => typeof a === "string" ? { title: a, description: "" } : a as { title: string; description: string });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label>{t("principal")}</Label><Input type="number" min="0" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} placeholder="Loan amount" /></div>
            <div><Label>{t("interestRate")}</Label><Input type="number" min="0" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} placeholder="Annual rate %" /></div>
            <div><Label>{t("tenure")}</Label><Input type="number" min="1" value={form.tenure_months} onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} /></div>
            <div><Label>{t("income")}</Label><Input type="number" min="0" value={form.income} onChange={(e) => setForm({ ...form, income: e.target.value })} placeholder="Monthly income" /></div>
            <div><Label>{t("expenses")}</Label><Input type="number" min="0" value={form.monthly_expenses} onChange={(e) => setForm({ ...form, monthly_expenses: e.target.value })} placeholder="Monthly expenses" /></div>
            <div><Label>{t("existingDebt")}</Label><Input type="number" min="0" value={form.existing_debt_payment} onChange={(e) => setForm({ ...form, existing_debt_payment: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleEmi} disabled={calcEmi.isPending} size="sm">
              <Calculator className="mr-1.5 h-3.5 w-3.5" />{t("calculate")}
            </Button>
            <Button variant="outline" onClick={handleSimulate} disabled={simulate.isPending} size="sm">
              <Play className="mr-1.5 h-3.5 w-3.5" />{t("simulate")}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {emiResult && (
        <Card>
          <CardHeader className="pb-3">          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("emi")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-primary/5 px-4 py-3">
                <p className="text-xs text-text-muted">{t("emi")}</p>
                <p className="mt-1 text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(toNumber(emiResult.monthly_emi))}</p>
              </div>
              <div className="rounded-lg bg-surface-container/30 px-4 py-3">
                <p className="text-xs text-text-muted">Total interest</p>
                <p className="mt-1 text-lg font-semibold font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(toNumber(emiResult.total_interest))}</p>
              </div>
              <div className="rounded-lg bg-surface-container/30 px-4 py-3">
                <p className="text-xs text-text-muted">Total payment</p>
                <p className="mt-1 text-lg font-semibold font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(toNumber(emiResult.total_payment))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {simulate.isPending && <Skeleton className="h-40 w-full" />}

      {simResult && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {toNumber(simResult.affordability_ratio) > 40 ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-income" />}
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("recommendation")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-text-muted leading-relaxed">{simResult.recommendation}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-surface-container/30 px-4 py-3">
                  <p className="text-xs text-text-muted">Cash flow before</p>
                  <p className="font-semibold font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(toNumber(simResult.cash_flow_before))}</p>
                </div>
                <div className="rounded-lg bg-surface-container/30 px-4 py-3">
                  <p className="text-xs text-text-muted">Cash flow after</p>
                  <p className={`font-semibold font-[family-name:var(--font-jetbrains-mono)] ${toNumber(simResult.cash_flow_after) < 0 ? "text-destructive" : ""}`}>{formatCurrency(toNumber(simResult.cash_flow_after))}</p>
                </div>
                <div className="rounded-lg bg-surface-container/30 px-4 py-3">
                  <p className="text-xs text-text-muted">Debt burden before</p>
                  <p className="font-semibold font-[family-name:var(--font-jetbrains-mono)]">{toNumber(simResult.debt_burden_before).toFixed(1)}%</p>
                </div>
                <div className="rounded-lg bg-surface-container/30 px-4 py-3">
                  <p className="text-xs text-text-muted">Debt burden after</p>
                  <p className={`font-semibold font-[family-name:var(--font-jetbrains-mono)] ${toNumber(simResult.debt_burden_after) > 40 ? "text-destructive" : ""}`}>{toNumber(simResult.debt_burden_after).toFixed(1)}%</p>
                </div>
              </div>
              {simResult.warnings?.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    <p className="font-medium text-xs">{t("warnings")}</p>
                  </div>
                  <ul className="space-y-1 text-xs text-text-muted">
                    {simResult.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {altItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-primary" />
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("alternatives")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {altItems.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 transition-colors hover:bg-surface-container">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.description && <p className="mt-1 text-xs text-text-muted">{a.description}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
