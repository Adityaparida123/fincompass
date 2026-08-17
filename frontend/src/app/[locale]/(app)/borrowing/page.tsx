"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { useCalculateEMI, useLoanSimulation } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import type { EMIResult, LoanSimulationResult } from "@/types";

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
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card><CardContent className="pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><Label>{t("principal")}</Label><Input type="number" min="0" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></div>
          <div><Label>{t("interestRate")}</Label><Input type="number" min="0" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} /></div>
          <div><Label>{t("tenure")}</Label><Input type="number" min="1" value={form.tenure_months} onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} /></div>
          <div><Label>{t("income")}</Label><Input type="number" min="0" value={form.income} onChange={(e) => setForm({ ...form, income: e.target.value })} /></div>
          <div><Label>{t("expenses")}</Label><Input type="number" min="0" value={form.monthly_expenses} onChange={(e) => setForm({ ...form, monthly_expenses: e.target.value })} /></div>
          <div><Label>{t("existingDebt")}</Label><Input type="number" min="0" value={form.existing_debt_payment} onChange={(e) => setForm({ ...form, existing_debt_payment: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleEmi} disabled={calcEmi.isPending}>{t("calculate")}</Button>
          <Button variant="outline" onClick={handleSimulate} disabled={simulate.isPending}>{t("simulate")}</Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent></Card>

      {emiResult && (
        <Card><CardHeader><CardTitle>{t("emi")}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
            <div><span className="text-muted-foreground">{t("emi")}</span><p className="text-xl font-bold">{formatCurrency(toNumber(emiResult.monthly_emi))}</p></div>
            <div><span className="text-muted-foreground">Total interest</span><p className="font-medium">{formatCurrency(toNumber(emiResult.total_interest))}</p></div>
            <div><span className="text-muted-foreground">Total payment</span><p className="font-medium">{formatCurrency(toNumber(emiResult.total_payment))}</p></div>
          </CardContent></Card>
      )}

      {simulate.isPending && <Skeleton className="h-40 w-full" />}

      {simResult && (
        <>
          <Card><CardHeader><CardTitle>{t("recommendation")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{simResult.recommendation}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>Cash flow before: <strong>{formatCurrency(toNumber(simResult.cash_flow_before))}</strong></div>
                <div>Cash flow after: <strong>{formatCurrency(toNumber(simResult.cash_flow_after))}</strong></div>
                <div>Debt burden before: <strong>{toNumber(simResult.debt_burden_before).toFixed(1)}%</strong></div>
                <div>Debt burden after: <strong>{toNumber(simResult.debt_burden_after).toFixed(1)}%</strong></div>
              </div>
              {simResult.warnings?.length > 0 && (
                <div><p className="font-medium">{t("warnings")}</p>
                  <ul className="list-disc pl-5 text-muted-foreground">{simResult.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
              )}
            </CardContent></Card>

          {altItems.length > 0 && (
            <Card><CardHeader><CardTitle>{t("alternatives")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {altItems.map((a, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <p className="font-medium text-sm">{a.title}</p>
                    {a.description && <p className="text-xs text-muted-foreground mt-1">{a.description}</p>}
                  </div>
                ))}
              </CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
