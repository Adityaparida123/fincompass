"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge } from "@/components/ui/input";
import { StatCard, PageHeader, EmptyState } from "@/components/common/shared";
import { useDebts, useCreateDebt } from "@/hooks/use-api";
import { formatCurrency, toNumber } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";
import { CreditCard, Plus, Wallet } from "lucide-react";

export default function DebtPage() {
  const t = useTranslations("debt");
  const tc = useTranslations("common");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", principal: "", monthly_payment: "", interest_rate: "", remaining_balance: "", due_date: "" });
  const [error, setError] = useState("");

  const debts = useDebts();
  const createDebt = useCreateDebt();

  const totalMonthly = debts.data?.reduce((s, d) => s + toNumber(d.monthly_payment), 0) ?? 0;
  const totalBalance = debts.data?.reduce((s, d) => s + toNumber(d.remaining_balance), 0) ?? 0;

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
                {d.due_date && <Badge variant="outline" className="text-[10px]">Due: {d.due_date}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("monthlyPayment")}</span>
                <span className="font-semibold">{formatCurrency(toNumber(d.monthly_payment))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("remainingBalance")}</span>
                <span className="font-medium">{formatCurrency(toNumber(d.remaining_balance))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("interestRate")}</span>
                <span>{toNumber(d.interest_rate).toFixed(2)}%</span>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="sm:col-span-2">
            <EmptyState
              title="No debt obligations yet"
              description="Add your debts to track monthly payments and monitor your debt burden."
              icon={CreditCard}
              action={<Button size="sm" onClick={() => setShowForm(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add debt</Button>}
            />
          </div>
        )}
      </div>
    </div>
  );
}
