"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format, getISOWeek, getYear } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge } from "@/components/ui/input";
import { ResponsiveBarChart, ResponsivePieChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import {
  useExpensesWeekly, useExpensesMonthly, useExpenseCategories,
  useTransactions, useCreateTransaction, useDeleteTransaction,
} from "@/hooks/use-api";
import { ImportStatementDialog } from "@/components/expenses/import-statement";
import { formatCurrency } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api";

export default function ExpensesPage() {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const now = new Date();
  const period = format(now, "yyyy-MM");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ date: format(now, "yyyy-MM-dd"), description: "", amount: "", category: "", transaction_type: "expense" });
  const [error, setError] = useState("");

  const params: Record<string, string> = {};
  if (categoryFilter) params.category = categoryFilter;
  if (typeFilter) params.transaction_type = typeFilter;

  const weekly = useExpensesWeekly(getYear(now), getISOWeek(now));
  const monthly = useExpensesMonthly(period);
  const categories = useExpenseCategories();
  const transactions = useTransactions(params);
  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const weeklyData = Object.entries(weekly.data?.daily_breakdown ?? {}).map(([day, val]) => ({
    day, amount: parseFloat(val),
  }));
  const monthlyData = Object.entries(monthly.data?.categories ?? {}).map(([name, val]) => ({
    name, value: parseFloat(val),
  }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createTx.mutateAsync({ ...form, amount: parseFloat(form.amount) });
      setShowForm(false);
      setForm({ date: format(now, "yyyy-MM-dd"), description: "", amount: "", category: "", transaction_type: "expense" });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(tc("confirm"))) return;
    try { await deleteTx.mutateAsync(id); } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>{t("importStatement")}</Button>
          <Button onClick={() => setShowForm(!showForm)}>{t("addTransaction")}</Button>
        </div>
      </div>

      <ImportStatementDialog open={showImport} onOpenChange={setShowImport} />

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              <div><Label>{t("description")}</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
              <div><Label>{t("amount")}</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
              <div><Label>{t("category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></div>
              <div><Label>{t("type")}</Label>
                <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}>
                  <option value="expense">{t("expense")}</option><option value="income">{t("income")}</option>
                </select>
              </div>
              <div className="flex items-end gap-2"><Button type="submit" disabled={createTx.isPending}>{tc("save")}</Button><Button type="button" variant="outline" onClick={() => setShowForm(false)}>{tc("cancel")}</Button></div>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("expense")}</CardTitle></CardHeader>
          <CardContent>{monthly.isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{formatCurrency(parseFloat(monthly.data?.total_expenses ?? "0"))}</p>}</CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("income")}</CardTitle></CardHeader>
          <CardContent>{monthly.isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{formatCurrency(parseFloat(monthly.data?.total_income ?? "0"))}</p>}</CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{monthly.data?.period ?? period}</CardTitle></CardHeader>
          <CardContent>{monthly.isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{monthly.data?.transaction_count ?? 0} txns</p>}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>{t("weeklyChart")}</CardTitle></CardHeader>
          <CardContent>{weekly.isLoading ? <ChartSkeleton /> : weekly.isError ? (
            <PageError message="Unable to load weekly breakdown." onRetry={() => weekly.refetch()} />
          ) : weeklyData.length ? (
            <ResponsiveBarChart data={weeklyData} xKey="day" bars={[{ key: "amount", name: t("expense"), color: "#6366f1" }]} />
          ) : <p className="text-sm text-muted-foreground">{tc("noData")}</p>}</CardContent>
        </Card>
        <Card><CardHeader><CardTitle>{t("monthlyChart")}</CardTitle></CardHeader>
          <CardContent>{monthly.isLoading ? <ChartSkeleton /> : monthlyData.length ? (
            <ResponsivePieChart data={monthlyData} />
          ) : <p className="text-sm text-muted-foreground">{tc("noData")}</p>}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("title")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">{t("allCategories")}</option>
              {categories.data?.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
            </select>
            <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{t("type")}</option><option value="expense">{t("expense")}</option><option value="income">{t("income")}</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {transactions.isLoading ? <Skeleton className="h-32 w-full" /> : transactions.isError ? (
            <PageError message={tc("error")} onRetry={() => transactions.refetch()} />
          ) : transactions.data?.items?.length ? transactions.data.items.map((tx) => (
            <div key={tx.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium text-sm">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{tx.date} · {tx.category} · <Badge variant={tx.transaction_type === "income" ? "success" : "secondary"}>{tx.transaction_type}</Badge></p></div>
              <div className="flex items-center gap-3">
                <span className={`font-semibold ${tx.transaction_type === "income" ? "text-emerald-600" : ""}`}>{formatCurrency(parseFloat(tx.amount))}</span>
                <Button size="sm" variant="outline" onClick={() => handleDelete(tx.id)} disabled={deleteTx.isPending}>{tc("delete")}</Button>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">{t("noTransactions")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
