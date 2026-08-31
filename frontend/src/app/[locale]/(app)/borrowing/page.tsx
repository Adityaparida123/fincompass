"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { useCalculateEMI, useLoanSimulation } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import type { EMIResult, LoanSimulationResult } from "@/types";
import { Calculator, Play, AlertTriangle, CheckCircle, XCircle, HandCoins, Sparkles, Cpu } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

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
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="UNDERWRITING SIMULATOR"
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant="cyan" pulse>EMI ENGINE</SpatialBadge>
          </div>
        }
      />

      {/* Simulator Inputs */}
      <GlassPanel glow="cyan" hudCorners className="p-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span>Loan Scenario Parameters</span>
          </h3>
          <span className="text-[11px] font-mono text-text-muted">MULTI-TENURE ANALYSIS</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label className="text-xs text-text-secondary">{t("principal")}</Label>
            <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} placeholder="e.g. 50000" />
          </div>
          <div>
            <Label className="text-xs text-text-secondary">{t("interestRate")}</Label>
            <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} placeholder="e.g. 12.5" />
          </div>
          <div>
            <Label className="text-xs text-text-secondary">{t("tenure")}</Label>
            <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="1" value={form.tenure_months} onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs text-text-secondary">{t("income")}</Label>
            <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" value={form.income} onChange={(e) => setForm({ ...form, income: e.target.value })} placeholder="Monthly income" />
          </div>
          <div>
            <Label className="text-xs text-text-secondary">{t("expenses")}</Label>
            <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" value={form.monthly_expenses} onChange={(e) => setForm({ ...form, monthly_expenses: e.target.value })} placeholder="Monthly expenses" />
          </div>
          <div>
            <Label className="text-xs text-text-secondary">{t("existingDebt")}</Label>
            <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" value={form.existing_debt_payment} onChange={(e) => setForm({ ...form, existing_debt_payment: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 pt-4 border-t border-white/5">
          <Button
            onClick={handleEmi}
            disabled={calcEmi.isPending}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
          >
            <Calculator className="mr-1.5 h-4 w-4" />{t("calculate")}
          </Button>
          <Button
            variant="outline"
            onClick={handleSimulate}
            disabled={simulate.isPending}
            className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 font-bold px-5"
          >
            <Play className="mr-1.5 h-4 w-4" />{t("simulate")}
          </Button>
        </div>
        {error && <p className="mt-3 text-xs font-mono text-rose-400">{error}</p>}
      </GlassPanel>

      {/* Basic EMI Results */}
      {emiResult && (
        <GlassPanel glow="cyan" hudCorners className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("emi")} Output</h3>
            <SpatialBadge variant="cyan">COMPUTED</SpatialBadge>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-4">
              <p className="text-[11px] font-mono uppercase text-cyan-300">{t("emi")}</p>
              <p className="mt-1 text-2xl font-bold font-mono text-cyan-400">{formatCurrency(toNumber(emiResult.monthly_emi))}</p>
            </div>
            <div className="rounded-xl bg-surface-container/60 border border-white/5 p-4">
              <p className="text-[11px] font-mono uppercase text-text-muted">Total Interest</p>
              <p className="mt-1 text-xl font-bold font-mono text-amber-400">{formatCurrency(toNumber(emiResult.total_interest))}</p>
            </div>
            <div className="rounded-xl bg-surface-container/60 border border-white/5 p-4">
              <p className="text-[11px] font-mono uppercase text-text-muted">Total Payment</p>
              <p className="mt-1 text-xl font-bold font-mono text-text-primary">{formatCurrency(toNumber(emiResult.total_payment))}</p>
            </div>
          </div>
        </GlassPanel>
      )}

      {simulate.isPending && <Skeleton className="h-44 w-full rounded-2xl" />}

      {/* Complete Simulation & Stress Test Output */}
      {simResult && (
        <>
          <GlassPanel
            glow={toNumber(simResult.affordability_ratio) > 40 ? "rose" : "emerald"}
            hudCorners
            className="p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                {toNumber(simResult.affordability_ratio) > 40 ? (
                  <XCircle className="h-5 w-5 text-rose-400" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                )}
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">{t("recommendation")}</h3>
              </div>
              <SpatialBadge variant={toNumber(simResult.affordability_ratio) > 40 ? "rose" : "emerald"}>
                {toNumber(simResult.affordability_ratio) > 40 ? "HIGH RISK" : "AFFORDABLE"}
              </SpatialBadge>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">{simResult.recommendation}</p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2">
              <div className="rounded-xl bg-surface-container/60 border border-white/5 p-3.5">
                <p className="text-[10px] font-mono uppercase text-text-muted">Cash Flow Before</p>
                <p className="text-lg font-bold font-mono text-text-primary mt-0.5">{formatCurrency(toNumber(simResult.cash_flow_before))}</p>
              </div>
              <div className="rounded-xl bg-surface-container/60 border border-white/5 p-3.5">
                <p className="text-[10px] font-mono uppercase text-text-muted">Cash Flow After</p>
                <p className={`text-lg font-bold font-mono mt-0.5 ${toNumber(simResult.cash_flow_after) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {formatCurrency(toNumber(simResult.cash_flow_after))}
                </p>
              </div>
              <div className="rounded-xl bg-surface-container/60 border border-white/5 p-3.5">
                <p className="text-[10px] font-mono uppercase text-text-muted">Debt Burden Before</p>
                <p className="text-lg font-bold font-mono text-text-primary mt-0.5">{toNumber(simResult.debt_burden_before).toFixed(1)}%</p>
              </div>
              <div className="rounded-xl bg-surface-container/60 border border-white/5 p-3.5">
                <p className="text-[10px] font-mono uppercase text-text-muted">Debt Burden After</p>
                <p className={`text-lg font-bold font-mono mt-0.5 ${toNumber(simResult.debt_burden_after) > 40 ? "text-rose-400" : "text-cyan-300"}`}>
                  {toNumber(simResult.debt_burden_after).toFixed(1)}%
                </p>
              </div>
            </div>

            {simResult.warnings?.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <p className="font-semibold text-xs text-amber-300">{t("warnings")}</p>
                </div>
                <ul className="space-y-1 text-xs text-text-secondary">
                  {simResult.warnings.map((w, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-amber-400" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </GlassPanel>

          {altItems.length > 0 && (
            <GlassPanel glow="cyan" hudCorners className="p-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-cyan-400" />
                  <span>{t("alternatives")}</span>
                </h3>
                <SpatialBadge variant="cyan">AI OPTIMIZED</SpatialBadge>
              </div>
              <div className="space-y-2.5">
                {altItems.map((a, i) => (
                  <div key={i} className="rounded-xl border border-white/5 bg-surface-container/60 p-4 transition-all hover:bg-surface-container hover:border-cyan-500/30">
                    <p className="text-xs font-semibold text-text-primary">{a.title}</p>
                    {a.description && <p className="mt-1 text-xs text-text-muted">{a.description}</p>}
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}
        </>
      )}
    </div>
  );
}
