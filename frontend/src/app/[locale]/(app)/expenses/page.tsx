"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format, getISOWeek, getYear } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { WeeklyExpensesChart, CategoryDonut, ChartCard, ChartSkeleton, PageError } from "@/components/charts/responsive-charts";
import { EmptyState } from "@/components/common/shared";
import {
  useExpensesWeekly, useExpensesMonthly, useExpenseCategories,
  useTransactions, useCreateTransaction, useDeleteTransaction,
} from "@/hooks/use-api";
import { ImportStatementDialog } from "@/components/expenses/import-statement";
import { formatCurrency, toNumber } from "@/lib/utils";
import { fillWeeklyDays } from "@/lib/chart-utils";
import { CATEGORIES } from "@/lib/constants";
import { resolveScope, BUSINESS_CATEGORIES_LIST, type ExpenseScope } from "@/lib/expense-scope";
import { ApiRequestError } from "@/lib/api";
import { Receipt, TrendingUp, FileText, Plus, Upload, Layers, Trash2 } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialMetric } from "@/components/spatial/spatial-metric";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

export default function ExpensesPage() {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const now = new Date();
  const period = format(now, "yyyy-MM");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"" | ExpenseScope>("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ date: format(now, "yyyy-MM-dd"), description: "", amount: "", category: "", transaction_type: "expense", expense_scope: "" });
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

  const weeklyData = fillWeeklyDays(weekly.data?.daily_breakdown ?? {});

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
      const { expense_scope, ...rest } = form;
      await createTx.mutateAsync({ ...rest, ...(expense_scope ? { expense_scope } : {}), amount: parseFloat(form.amount) });
      setShowForm(false);
      setForm({ date: format(now, "yyyy-MM-dd"), description: "", amount: "", category: "", transaction_type: "expense", expense_scope: "" });
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
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="LEDGER & TRANSACTIONS"
        title={t("title")}
        subtitle="Telemetry of cash flows, category allocations, and categorized transactions"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
              className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 font-bold"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />{t("importStatement")}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />{t("addTransaction")}
            </Button>
          </div>
        }
      />

      <ImportStatementDialog open={showImport} onOpenChange={setShowImport} />

      {/* Transaction Entry Drawer */}
      {showForm && (
        <GlassPanel glow="cyan" hudCorners className="p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("addTransaction")}</h3>
            <SpatialBadge variant="cyan">RECORD ENTRY</SpatialBadge>
          </div>
          <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs text-text-secondary">{t("date")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("description")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("amount")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("category")}</Label>
              <select className="flex h-10 w-full mt-1 rounded-xl border border-cyan-500/20 bg-surface-container px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-400" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="" disabled>{t("selectCategory")}</option>
                <optgroup label="Business">
                  {BUSINESS_CATEGORIES_LIST.map((cat) => <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>)}
                </optgroup>
                <optgroup label="Personal">
                  {CATEGORIES.filter((c) => c !== "income").map((cat) => <option key={cat} value={cat}>{cat.replace(/_/g, " ")}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("scope")}</Label>
              <select className="flex h-10 w-full mt-1 rounded-xl border border-cyan-500/20 bg-surface-container px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-400" value={form.expense_scope} onChange={(e) => setForm({ ...form, expense_scope: e.target.value })}>
                <option value="">{t("scopeAuto")}</option>
                <option value="business">{t("business")}</option>
                <option value="personal">{t("personal")}</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("type")}</Label>
              <select className="flex h-10 w-full mt-1 rounded-xl border border-cyan-500/20 bg-surface-container px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-400" value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}>
                <option value="expense">{t("expense")}</option><option value="income">{t("income")}</option>
              </select>
            </div>
            <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-3 pt-2">
              <Button type="submit" disabled={createTx.isPending} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6">
                {createTx.isPending ? "SAVING..." : tc("save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/10 text-text-secondary">
                {tc("cancel")}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-xs font-mono text-rose-400">{error}</p>}
        </GlassPanel>
      )}

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {monthly.isError ? (
          <div className="sm:col-span-3">
            <PageError message={monthly.error instanceof Error ? monthly.error.message : tc("error")} onRetry={() => monthly.refetch()} />
          </div>
        ) : (
          <>
            <SpatialMetric label={t("expense")} value={formatCurrency(toNumber(monthly.data?.total_expenses))} subtitle={t("thisMonth")} glow="rose" icon={<Receipt className="h-4 w-4 text-rose-400" />} />
            <SpatialMetric label={t("income")} value={formatCurrency(toNumber(monthly.data?.total_income))} subtitle={t("thisMonth")} glow="emerald" icon={<TrendingUp className="h-4 w-4 text-emerald-400" />} />
            <SpatialMetric label="Txn Volume" value={`${monthly.data?.transaction_count ?? 0} txns`} subtitle={monthly.data?.period ?? period} glow="cyan" icon={<FileText className="h-4 w-4 text-cyan-400" />} />
          </>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={t("weeklyChart")} subtitle="Daily expense breakdown">
          {weekly.isLoading ? <ChartSkeleton variant="area" /> : weekly.isError ? (
            <PageError message="Unable to load weekly breakdown." onRetry={() => weekly.refetch()} />
          ) : weeklyData.length ? (
            <WeeklyExpensesChart data={weeklyData} valueFormatter={(v) => formatCurrency(v)} />
          ) : (
            <div className="flex h-64 items-center justify-center text-xs font-mono text-text-muted">
              No weekly data yet. Add transactions for this week.
            </div>
          )}
        </ChartCard>
        <ChartCard title={t("monthlyChart")} subtitle="Spending by category">
          {monthly.isLoading ? <ChartSkeleton variant="donut" /> : monthly.isError ? (
            <PageError message={monthly.error instanceof Error ? monthly.error.message : tc("error")} onRetry={() => monthly.refetch()} />
          ) : monthlyData.length ? (
            <CategoryDonut data={monthlyData} valueFormatter={(v) => formatCurrency(v)} centerLabel="Total" centerValue={formatCurrency(toNumber(monthly.data?.total_expenses))} />
          ) : (
            <div className="flex h-64 items-center justify-center text-xs font-mono text-text-muted">
              No category data yet.
            </div>
          )}
        </ChartCard>
      </div>

      {/* Category Matrices */}
      <GlassPanel className="p-6">
        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <span>{t("categories")}</span>
          </h3>
          <span className="text-[11px] font-mono text-text-muted">SECTOR ALLOCATION</span>
        </div>
        {categories.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allCategories.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-surface-container/60 px-4 py-3 transition-all hover:bg-surface-container hover:border-cyan-500/20"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary capitalize">{cat.category.replace(/_/g, " ")}</p>
                  <p className="text-[10px] font-mono text-text-muted">{cat.count} txn{cat.count !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold font-mono text-cyan-300">{formatCurrency(cat.total)}</p>
                  <p className="text-[10px] font-mono text-text-muted">{cat.percent.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Transactions Ledger */}
      <GlassPanel hudCorners className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/5 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-400" />
            <span>{t("title")}</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-surface-container p-0.5" role="group" aria-label={t("scope")}>
              {([["", t("scopeAll")], ["business", t("business")], ["personal", t("personal")], ["mixed", t("mixed")]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScopeFilter(value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-mono transition-colors ${scopeFilter === value ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(0,242,254,0.3)]" : "text-text-muted hover:text-text-primary"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select className="h-8 rounded-xl border border-white/10 bg-surface-container px-2 text-xs text-text-primary focus:outline-none" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">{t("allCategories")}</option>
              {categories.data?.map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
            </select>
            <select className="h-8 rounded-xl border border-white/10 bg-surface-container px-2 text-xs text-text-primary focus:outline-none" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{t("type")}</option><option value="expense">{t("expense")}</option><option value="income">{t("income")}</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {(() => {
            const items = (transactions.data?.items ?? []).filter(
              (tx) => !scopeFilter || resolveScope(tx.category, tx.expense_scope) === scopeFilter,
            );
            return (
              <>
                {transactions.isLoading ? (
                  <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
                ) : transactions.isError ? (
                  <PageError message={tc("error")} onRetry={() => transactions.refetch()} />
                ) : items.length ? items.map((tx) => {
                  const scope = resolveScope(tx.category, tx.expense_scope);
                  return (
                    <div key={tx.id} className="flex flex-col gap-2 rounded-xl border border-white/5 bg-surface-container/40 px-4 py-3 transition-all hover:bg-surface-container hover:border-white/10 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex items-center gap-3 sm:min-w-0 sm:flex-1">
                        <div className={`h-8 w-1 shrink-0 rounded-full ${tx.transaction_type === "income" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-400 shadow-[0_0_8px_#f87171]"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-text-primary">{tx.description}</p>
                          <p className="text-[10px] font-mono text-text-muted sm:hidden">{tx.date}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-bold font-mono ${tx.transaction_type === "income" ? "text-emerald-400" : "text-text-primary"}`}>
                          {tx.transaction_type === "income" ? "+" : "-"}{formatCurrency(toNumber(tx.amount))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:shrink-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="hidden text-[10px] font-mono text-text-muted sm:inline">{tx.date}</span>
                          <SpatialBadge variant={tx.transaction_type === "income" ? "emerald" : "rose"}>{tx.transaction_type}</SpatialBadge>
                          <SpatialBadge variant={scope === "business" ? "cyan" : scope === "mixed" ? "amber" : "neutral"}>
                            {scope === "mixed" ? t("possiblyMixed") : t(scope)}
                          </SpatialBadge>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => handleDelete(tx.id)} disabled={deleteTx.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                }) : (
                  <EmptyState
                    title={t("noTransactions")}
                    description="Add your first transaction or import multiple transactions to start tracking."
                    icon={FileText}
                    action={
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowImport(true)} className="border-cyan-500/30 text-cyan-300">Import transactions</Button>
                        <Button size="sm" onClick={() => setShowForm(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold">Add transaction</Button>
                      </div>
                    }
                  />
                )}
                {transactions.data && transactions.data.total > 20 && (
                  <p className="text-center text-xs font-mono text-text-muted pt-3">
                    Showing {items.length} of {transactions.data.total} transactions
                  </p>
                )}
              </>
            );
          })()}
        </div>
      </GlassPanel>
    </div>
  );
}
