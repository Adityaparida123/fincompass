"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge } from "@/components/ui/input";
import { StatCard, PageHeader, EmptyState } from "@/components/common/shared";
import { useDebts, useCreateDebt, useExpensesMonthly } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import { CreditCard, Plus, Wallet, AlertTriangle, ShieldCheck, Info } from "lucide-react";

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
          icon: AlertTriangle,
          msgKey: "impactStrained",
          barCls: "bg-destructive",
        }
      : debtToIncome > 20 ? {
          tone: "warning" as const,
          icon: Info,
          msgKey: "impactModerate",
          barCls: "bg-warning",
        }
      : {
          tone: "healthy" as const,
          icon: ShieldCheck,
          msgKey: "impactHealthy",
          barCls: "bg-primary",
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
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        action={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />{t("addDebt")}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={t("totalObligations")} value={`${formatCurrency(totalMonthly)}/mo`} icon={Wallet} loading={debts.isLoading} />
        <StatCard label={t("remainingBalance")} value={formatCurrency(totalBalance)} icon={CreditCard} loading={debts.isLoading} />
      </div>

      {/* Cash-flow impact */}
      {impact && totalMonthly > 0 && hasTransactions && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("impactTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed ${
                impact.tone === "destructive"
                  ? "border-destructive/30 bg-destructive/5 text-text-primary"
                  : impact.tone === "warning"
                    ? "border-warning/30 bg-warning/5 text-text-primary"
                    : "border-primary/25 bg-primary/5 text-text-primary"
              }`}
              role="status"
            >
              <impact.icon className={`mt-0.5 h-4 w-4 shrink-0 ${impact.tone === "destructive" ? "text-destructive" : impact.tone === "warning" ? "text-warning" : "text-primary"}`} />
              <span>{t(impact.msgKey, { percent: `${Math.round(debtToIncome ?? 0)}`, payments: formatCurrency(totalMonthly), left: formatCurrency(Math.abs(leftAfterPayments)) })}</span>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-text-muted">{t("impactRatioLabel")}</span>
                <span className="font-medium font-[family-name:var(--font-jetbrains-mono)]">{debtToIncome?.toFixed(0)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${impact.barCls}`}
                  style={{ width: `${Math.min(100, Math.max(2, debtToIncome ?? 0))}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-text-muted">{t("impactBasis", { income: formatCurrency(monthlyIncome) })}</p>
              {leftAfterPayments < 0 && (
                <p className="mt-1 text-[11px] font-medium text-destructive">{t("impactNegative", { amount: formatCurrency(Math.abs(leftAfterPayments)) })}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card><CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Home loan" required /></div>
            <div><Label>{t("principal")}</Label><Input type="number" min="0" step="0.01" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} required /></div>
            <div><Label>{t("monthlyPayment")}</Label><Input type="number" min="0" step="0.01" value={form.monthly_payment} onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })} required /></div>
            <div><Label>{t("interestRate")}</Label><Input type="number" min="0" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} required /></div>
            <div><Label>{t("remainingBalance")}</Label><Input type="number" min="0" step="0.01" value={form.remaining_balance} onChange={(e) => setForm({ ...form, remaining_balance: e.target.value })} required /></div>
            <div><Label>{t("dueDate")}</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="flex gap-2 lg:col-span-3"><Button type="submit" disabled={createDebt.isPending}>{tc("save")}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>{tc("cancel")}</Button></div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {debts.isLoading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : debts.data?.length ? debts.data.map((d) => (
          <Card key={d.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{d.name}</CardTitle>
                {d.due_date && (
                  <Badge variant="outline" className="text-[10px]">
                    {t("dueOn", { date: new Date(`${d.due_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }) })}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{t("monthlyPayment")}</span>
                <span className="font-semibold font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(toNumber(d.monthly_payment))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{t("remainingBalance")}</span>
                <span className="font-medium font-[family-name:var(--font-jetbrains-mono)]">{formatCurrency(toNumber(d.remaining_balance))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{t("interestRate")}</span>
                <span className="font-[family-name:var(--font-jetbrains-mono)]">{toNumber(d.interest_rate).toFixed(2)}%</span>
              </div>
              {debtToIncome != null && monthlyIncome > 0 && toNumber(d.monthly_payment) > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-text-muted">{t("shareOfIncome")}</span>
                  <span className={`font-medium ${toNumber(d.monthly_payment) / monthlyIncome > 0.3 ? "text-destructive" : "text-text-primary"}`}>
                    {Math.round((toNumber(d.monthly_payment) / monthlyIncome) * 100)}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )) : (
          <div className="sm:col-span-2">
            <EmptyState
              title={t("noDebtsTitle")}
              description={t("noDebtsDesc")}
              icon={CreditCard}
              action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />{t("addDebt")}</Button>}
            />
          </div>
        )}
      </div>
    </div>
  );
}
