"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { useDebts, useCreateDebt } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";

export default function DebtPage() {
  const t = useTranslations("debt");
  const tc = useTranslations("common");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", principal: "", monthly_payment: "", interest_rate: "", remaining_balance: "", due_date: "" });
  const [error, setError] = useState("");

  const debts = useDebts();
  const createDebt = useCreateDebt();

  const totalMonthly = debts.data?.reduce((s, d) => s + parseFloat(d.monthly_payment), 0) ?? 0;
  const totalBalance = debts.data?.reduce((s, d) => s + parseFloat(d.remaining_balance), 0) ?? 0;

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <Button onClick={() => setShowForm(!showForm)}>{t("addDebt")}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("totalObligations")}</CardTitle></CardHeader>
          <CardContent>{debts.isLoading ? <Skeleton className="h-8 w-28" /> : <p className="text-2xl font-bold">{formatCurrency(totalMonthly)}/mo</p>}</CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("remainingBalance")}</CardTitle></CardHeader>
          <CardContent>{debts.isLoading ? <Skeleton className="h-8 w-28" /> : <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>}</CardContent>
        </Card>
      </div>

      {showForm && (
        <Card><CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
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
        {debts.isLoading ? <Skeleton className="h-32 w-full sm:col-span-2" /> : debts.data?.length ? debts.data.map((d) => (
          <Card key={d.id}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{d.name}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("monthlyPayment")}</span><span className="font-medium">{formatCurrency(parseFloat(d.monthly_payment))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("remainingBalance")}</span><span>{formatCurrency(parseFloat(d.remaining_balance))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("interestRate")}</span><span>{parseFloat(d.interest_rate).toFixed(2)}%</span></div>
              {d.due_date && <p className="text-xs text-muted-foreground">Due: {d.due_date}</p>}
            </CardContent>
          </Card>
        )) : <p className="text-sm text-muted-foreground sm:col-span-2">{t("noDebts")}</p>}
      </div>
    </div>
  );
}
