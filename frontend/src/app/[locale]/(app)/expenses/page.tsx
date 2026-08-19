"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format, getISOWeek, getYear } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton, Badge } from "@/components/ui/input";
import { ResponsiveBarChart, ResponsivePieChart, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { StatCard, PageHeader, EmptyState } from "@/components/common/shared";
import {
  useExpensesWeekly, useExpensesMonthly, useExpenseCategories,
  useTransactions, useCreateTransaction, useDeleteTransaction,
} from "@/hooks/use-api";
import { ImportStatementDialog } from "@/components/expenses/import-statement";
import { formatCurrency, toNumber } from "@/lib/utils";
import { CATEGORIES } from "@/lib/constants";
import { ApiRequestError } from "@/lib/api";
import { Receipt, TrendingUp, FileText, Plus, Upload } from "lucide-react";

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
    day, amount: toNumber(val),
  }));
  const monthlyData = Object.entries(monthly.data?.categories ?? {}).map(([name, val]) => ({
    name, value: toNumber(val),
  }));

  const categoryMap = new Map(
    (categories.data ?? []).map((c) => [c.category, { total: toNumber(c.total), percent: toNumber(c.share_percent), count: c.count }]),
  );
  const allCategories = CATEGORIES.map((cat) => ({
    category: cat,
    total: categoryMap.get(cat)?.total ?? 0,
    percent: categoryMap.get(cat)?.percent ?? 0,
    count: categoryMap.get(cat)?.count ?? 0,
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
      <PageHeader
        title={t("title")}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />{t("importStatement")}
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />{t("addTransaction")}
            </Button>
          </div>
        }
      />

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
        {monthly.isError ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <PageError message={monthly.error instanceof Error ? monthly.error.message : tc("error")} onRetry={() => monthly.refetch()} />
          </div>
        ) : (
          <>
            <StatCard label={t("expense")} value={formatCurrency(toNumber(monthly.data?.total_expenses))} icon={Receipt} loading={monthly.isLoading} />
            <StatCard label={t("income")} value={formatCurrency(toNumber(monthly.data?.total_income))} icon={TrendingUp} loading={monthly.isLoading} />
            <StatCard label={monthly.data?.period ?? period} value={`${monthly.data?.transaction_count ?? 0} txns`} icon={FileText} loading={monthly.isLoading} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("weeklyChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            {weekly.isLoading ? <ChartSkeleton /> : weekly.isError ? (
              <PageError message="Unable to load weekly breakdown." onRetry={() => weekly.refetch()} />
            ) : weeklyData.length ? (
              <ResponsiveBarChart data={weeklyData} xKey="day" bars={[{ key: "amount", name: t("expense"), color: "#818cf8" }]} valueFormatter={(v) => formatCurrency(v)} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No weekly data yet. Add transactions for this week.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("monthlyChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthly.isLoading ? <ChartSkeleton /> : monthly.isError ? (
              <PageError message={monthly.error instanceof Error ? monthly.error.message : tc("error")} onRetry={() => monthly.refetch()} />
            ) : monthlyData.length ? (
              <ResponsivePieChart data={monthlyData} valueFormatter={(v) => formatCurrency(v)} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No category data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t("categories")}</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allCategories.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between rounded-xl border border-muted/50 px-4 py-3 transition-colors hover:bg-muted/20"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">{cat.category.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{cat.count} transaction{cat.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(cat.total)}</p>
                    <p className="text-xs text-muted-foreground">{cat.percent.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
          <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <select className="h-8 rounded-lg border border-input bg-background px-2 text-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">{t("allCategories")}</option>
              {categories.data?.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
            </select>
            <select className="h-8 rounded-lg border border-input bg-background px-2 text-xs" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{t("type")}</option><option value="expense">{t("expense")}</option><option value="income">{t("income")}</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {transactions.isLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : transactions.isError ? (
            <PageError message={tc("error")} onRetry={() => transactions.refetch()} />
          ) : transactions.data?.items?.length ? transactions.data.items.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 rounded-lg border border-muted/50 px-4 py-3 transition-colors hover:bg-muted/20">
              <div className={`h-8 w-1 rounded-full ${tx.transaction_type === "income" ? "bg-income" : "bg-expense"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{tx.date}</span>
                  <span>·</span>
                  <span className="capitalize">{tx.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${tx.transaction_type === "income" ? "text-income" : ""}`}>
                  {tx.transaction_type === "income" ? "+" : "-"}{formatCurrency(toNumber(tx.amount))}
                </span>
                <Badge variant={tx.transaction_type === "income" ? "success" : "secondary"} className="text-[10px]">{tx.transaction_type}</Badge>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(tx.id)} disabled={deleteTx.isPending}>
                  {tc("delete")}
                </Button>
              </div>
            </div>
          )) : (
            <EmptyState
              title={t("noTransactions")}
              description="Add your first transaction or import a bank statement to start tracking."
              icon={FileText}
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>Import statement</Button>
                  <Button size="sm" onClick={() => setShowForm(true)}>Add transaction</Button>
                </div>
              }
            />
          )}
          {transactions.data && transactions.data.total > 20 && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              Showing {transactions.data.items.length} of {transactions.data.total} transactions
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
