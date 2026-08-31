"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { EmptyState } from "@/components/common/shared";
import { useDebts, useCreateDebt, useExpensesMonthly } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import { CreditCard, Plus, Wallet, AlertTriangle, ShieldCheck, Info, Sparkles } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialMetric } from "@/components/spatial/spatial-metric";
import { SpatialBadge } from "@/components/spatial/spatial-badge";
import { DebtVisualizer } from "@/components/3d/debt-visualizer";

export default function DebtPage() {
  const t = useTranslations("debt");
  const tc = useTranslations("common");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", principal: "", monthly_payment: "", interest_rate: "", remaining_balance: "", due_date: "" });
  const [error, setError] = useState("");

  const debts = useDebts();
  const createDebt = useCreateDebt();
  const monthly = useExpensesMonthly(new Date().toISOString().slice(0, 7));

  const totalMonthly = debts.data?.reduce((s, d) => s + toNumber(d.monthly_payment), 0) ?? 0;
  const totalBalance = debts.data?.reduce((s, d) => s + toNumber(d.remaining_balance), 0) ?? 0;

  // ── Cash-flow impact ────────────────────────────────────────────
  const monthlyIncome = toNumber(monthly.data?.total_income);
  const netCashFlow = toNumber(monthly.data?.net_cash_flow);
  const hasTransactions = (monthly.data?.transaction_count ?? 0) > 0;
  const debtToIncome = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : null;
  const leftAfterPayments = netCashFlow - totalMonthly;
  const impact =
    debtToIncome == null ? null
      : debtToIncome > 40 ? {
          tone: "destructive" as const,
          badgeVariant: "rose" as const,
          icon: AlertTriangle,
          msgKey: "impactStrained",
          barCls: "bg-rose-500 shadow-[0_0_10px_#f87171]",
        }
      : debtToIncome > 20 ? {
          tone: "warning" as const,
          badgeVariant: "amber" as const,
          icon: Info,
          msgKey: "impactModerate",
          barCls: "bg-amber-400 shadow-[0_0_10px_#fbbf24]",
        }
      : {
          tone: "healthy" as const,
          badgeVariant: "emerald" as const,
          icon: ShieldCheck,
          msgKey: "impactHealthy",
          barCls: "bg-emerald-400 shadow-[0_0_10px_#34d399]",
        };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createDebt.mutateAsync({
        name: form.name,
        principal: parseFloat(form.principal),
        monthly_payment: parseFloat(form.monthly_payment),
        interest_rate: parseFloat(form.interest_rate),
        remaining_balance: parseFloat(form.remaining_balance),
        due_date: form.due_date || null,
      });
      setShowForm(false);
      setForm({ name: "", principal: "", monthly_payment: "", interest_rate: "", remaining_balance: "", due_date: "" });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="LIABILITY PROTOCOL"
        title={t("title")}
        subtitle="Manage obligations, loan schedules, and debt-to-income stress indices"
        action={
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
          >
            <Plus className="mr-1.5 h-4 w-4" />{t("addDebt")}
          </Button>
        }
      />

      {/* 3D Gyroscope + High Level Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-4">
          <GlassPanel glow={debtToIncome && debtToIncome > 40 ? "rose" : "cyan"} hudCorners className="p-5 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-between w-full pb-2 border-b border-white/5 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Liability Load Gyro</span>
              {impact && <SpatialBadge variant={impact.badgeVariant}>{Math.round(debtToIncome ?? 0)}% DTI</SpatialBadge>}
            </div>
            <DebtVisualizer debtRatio={debtToIncome ? debtToIncome / 100 : 0.2} size={180} />
            <span className="text-[10px] font-mono text-text-muted mt-2">DTI RATIO VISUALIZATION</span>
          </GlassPanel>
        </div>

        <div className="lg:col-span-8 grid gap-4 sm:grid-cols-2">
          <SpatialMetric
            label={t("totalObligations")}
            value={`${formatCurrency(totalMonthly)}/mo`}
            subtitle="Recurring Monthly Commitment"
            glow="amber"
            icon={<Wallet className="h-4 w-4 text-amber-400" />}
          />
          <SpatialMetric
            label={t("remainingBalance")}
            value={formatCurrency(totalBalance)}
            subtitle="Total Outstanding Principal"
            glow="rose"
            icon={<CreditCard className="h-4 w-4 text-rose-400" />}
          />
        </div>
      </div>

      {/* Cash-flow impact diagnosis */}
      {impact && totalMonthly > 0 && hasTransactions && (
        <GlassPanel glow={impact.tone === "destructive" ? "rose" : impact.tone === "warning" ? "amber" : "emerald"} hudCorners className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>{t("impactTitle")}</span>
            </h3>
            <SpatialBadge variant={impact.badgeVariant}>
              {impact.tone.toUpperCase()}
            </SpatialBadge>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-container/60 p-4 text-xs leading-relaxed text-text-primary">
              <impact.icon className={`mt-0.5 h-4 w-4 shrink-0 ${impact.tone === "destructive" ? "text-rose-400" : impact.tone === "warning" ? "text-amber-400" : "text-emerald-400"}`} />
              <p>{t(impact.msgKey, { percent: `${Math.round(debtToIncome ?? 0)}`, payments: formatCurrency(totalMonthly), left: formatCurrency(Math.abs(leftAfterPayments)) })}</p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-mono">
                <span className="text-text-muted">{t("impactRatioLabel")}</span>
                <span className="font-bold text-cyan-300">{debtToIncome?.toFixed(0)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${impact.barCls}`}
                  style={{ width: `${Math.min(100, Math.max(2, debtToIncome ?? 0))}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] font-mono text-text-muted">{t("impactBasis", { income: formatCurrency(monthlyIncome) })}</p>
              {leftAfterPayments < 0 && (
                <p className="mt-1 text-xs font-mono font-bold text-rose-400">{t("impactNegative", { amount: formatCurrency(Math.abs(leftAfterPayments)) })}</p>
              )}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Add Debt Drawer */}
      {showForm && (
        <GlassPanel glow="cyan" hudCorners className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("addDebt")}</h3>
            <SpatialBadge variant="cyan">NEW LIABILITY</SpatialBadge>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs text-text-secondary">{t("name")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Equipment Loan" required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("principal")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("monthlyPayment")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.monthly_payment} onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("interestRate")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("remainingBalance")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.remaining_balance} onChange={(e) => setForm({ ...form, remaining_balance: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("dueDate")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="flex gap-3 lg:col-span-3 pt-2">
              <Button type="submit" disabled={createDebt.isPending} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6">
                {createDebt.isPending ? "RECORDING..." : tc("save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-text-secondary">
                {tc("cancel")}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-xs font-mono text-rose-400">{error}</p>}
        </GlassPanel>
      )}

      {/* Debts Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {debts.isLoading ? (
          <>
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </>
        ) : debts.data?.length ? debts.data.map((d) => (
          <GlassPanel key={d.id} glow="none" hudCorners className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">LOAN REF #{d.id?.slice(0, 6)}</span>
                  <h4 className="text-sm font-semibold text-text-primary mt-0.5">{d.name}</h4>
                </div>
                {d.due_date && (
                  <SpatialBadge variant="cyan">
                    {t("dueOn", { date: new Date(`${d.due_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) })}
                  </SpatialBadge>
                )}
              </div>
              <div className="space-y-2 text-xs pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">{t("monthlyPayment")}</span>
                  <span className="font-bold font-mono text-cyan-300">{formatCurrency(toNumber(d.monthly_payment))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">{t("remainingBalance")}</span>
                  <span className="font-mono text-text-primary font-semibold">{formatCurrency(toNumber(d.remaining_balance))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">{t("interestRate")}</span>
                  <span className="font-mono text-emerald-400 font-semibold">{toNumber(d.interest_rate).toFixed(2)}% p.a.</span>
                </div>
              </div>
            </div>

            {debtToIncome != null && monthlyIncome > 0 && toNumber(d.monthly_payment) > 0 && (
              <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3 text-xs font-mono">
                <span className="text-text-muted">{t("shareOfIncome")}</span>
                <span className={`font-bold ${toNumber(d.monthly_payment) / monthlyIncome > 0.3 ? "text-rose-400" : "text-cyan-300"}`}>
                  {Math.round((toNumber(d.monthly_payment) / monthlyIncome) * 100)}%
                </span>
              </div>
            )}
          </GlassPanel>
        )) : (
          <div className="sm:col-span-2">
            <EmptyState
              title={t("noDebtsTitle")}
              description={t("noDebtsDesc")}
              icon={CreditCard}
              action={<Button size="sm" onClick={() => setShowForm(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"><Plus className="mr-1.5 h-3.5 w-3.5" />{t("addDebt")}</Button>}
            />
          </div>
        )}
      </div>
    </div>
  );
}
