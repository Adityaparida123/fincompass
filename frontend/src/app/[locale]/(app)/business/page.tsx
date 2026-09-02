"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  ChartNoAxesCombined,
  ChevronDown,
  CircleDollarSign,
  IndianRupee,
  Package,
  Plus,
  Save,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Wallet,
  X,
} from "lucide-react";

import {
  useBusinessCustomers,
  useBusinessDashboard,
  useBusinessProfile,
  useBusinessProfitIdeas,
  useBusinessSales,
  useCreateBusinessSale,
  useCreateBusinessPurchase,
} from "@/hooks/use-api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiRequestError } from "@/lib/api";

type SaleItem = {
  name: string;
  quantity: string;
  unit: string;
  unit_price: string;
};

const emptyItem = (): SaleItem => ({
  name: "",
  quantity: "1",
  unit: "",
  unit_price: "",
});

function money(value: number | undefined | null) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function saleErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) {
      return "The sale API is unavailable. Restart the backend server and try again.";
    }
    return error.message;
  }

  return "Could not save the sale. Please check the details and try again.";
}

type Period = "today" | "week" | "month" | "custom";
type ProfitGranularity = "weekly" | "monthly";

function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodDates(period: Exclude<Period, "custom">) {
  const end = new Date();
  const start = new Date(end);
  if (period === "week") {
    const weekday = end.getDay() || 7;
    start.setDate(end.getDate() - weekday + 1);
  }
  if (period === "month") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  }
  return { startDate: toDateInput(start), endDate: toDateInput(end) };
}

function profitAnalysisDates() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(end.getMonth() - 6);
  return { startDate: toDateInput(start), endDate: toDateInput(end) };
}

function startOfWeek(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return toDateInput(date);
}

export default function BusinessPage() {
  const locale = useLocale();
  const { data: profile, isLoading: profileLoading } = useBusinessProfile();
  const { data: sales = [], isLoading: salesLoading } = useBusinessSales(10);
  const { data: customers = [] } = useBusinessCustomers(100);
  const [period, setPeriod] = useState<Period>("today");
  const [dateRange, setDateRange] = useState(() => periodDates("today"));
  const [profitGranularity, setProfitGranularity] = useState<ProfitGranularity>("weekly");
  const [analysisRange] = useState(profitAnalysisDates);
  const dashboard = useBusinessDashboard(dateRange.startDate, dateRange.endDate);
  const profitAnalysis = useBusinessDashboard(analysisRange.startDate, analysisRange.endDate);
  const profitIdeas = useBusinessProfitIdeas();

  const createSale = useCreateBusinessSale();
  const createPurchase = useCreateBusinessPurchase();

  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);

  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<SaleItem[]>([emptyItem()]);

  const [showProfile, setShowProfile] = useState(false);

  function selectPeriod(nextPeriod: Exclude<Period, "custom">) {
    setPeriod(nextPeriod);
    setDateRange(periodDates(nextPeriod));
  }

  const calculatedTotal = useMemo(() => {
    if (!detailedMode) {
      return Number(amount || 0);
    }

    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);

      return sum + quantity * price;
    }, 0);
  }, [amount, detailedMode, items]);

  const paid = useMemo(() => {
    if (paymentMethod !== "credit") {
      return calculatedTotal;
    }

    return Number(paidAmount || 0);
  }, [calculatedTotal, paidAmount, paymentMethod]);

  const due = Math.max(calculatedTotal - paid, 0);

  const profitTrend = useMemo(() => {
    const groups = new Map<string, { label: string; profit: number }>();
    (profitAnalysis.data?.trend ?? []).forEach((point) => {
      const key = profitGranularity === "weekly"
        ? startOfWeek(point.date)
        : point.date.slice(0, 7);
      const current = groups.get(key) ?? {
        label: profitGranularity === "weekly"
          ? `Week of ${formatDate(key)}`
          : new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        profit: 0,
      };
      current.profit += Number(point.profit);
      groups.set(key, current);
    });
    return [...groups.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([, value]) => value);
  }, [profitAnalysis.data, profitGranularity]);

  function resetSaleForm() {
    setAmount("");
    setCustomerName("");
    setPaymentMethod("cash");
    setPaidAmount("");
    setNotes("");
    setItems([emptyItem()]);
    setDetailedMode(false);
  }

  function closeSaleForm() {
    setShowSaleForm(false);
    resetSaleForm();
  }

  function updateItem(
    index: number,
    field: keyof SaleItem,
    value: string,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;

    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function handleCreateSale() {
    if (calculatedTotal <= 0) {
      return;
    }

    if (paid > calculatedTotal) {
      return;
    }

    const validItems = detailedMode
      ? items
          .filter(
            (item) =>
              item.name.trim() &&
              Number(item.quantity) > 0 &&
              Number(item.unit_price) >= 0,
          )
          .map((item) => ({
            name: item.name.trim(),
            quantity: Number(item.quantity),
            unit: item.unit.trim() || "unit",
            unit_price: Number(item.unit_price),
          }))
      : [];

    if (detailedMode && validItems.length === 0) {
      return;
    }

    const body: Record<string, unknown> = {
      customer_name: customerName.trim() || undefined,
      payment_method: paymentMethod,
      notes: notes.trim() || undefined,
    };

    if (detailedMode) {
      body.items = validItems;
    } else {
      body.amount = calculatedTotal;
    }

    if (paymentMethod === "credit") {
      body.paid_amount = paid;
    } else {
      body.paid_amount = calculatedTotal;
    }

    try {
      await createSale.mutateAsync(body);
      closeSaleForm();
    } catch {
      // API error is exposed by the mutation state.
    }
  }

  const businessName =
    profile?.business_name?.trim() || "My Business";

  const isBusy =
    dashboard.isLoading ||
    salesLoading ||
    profileLoading;

  return (
    <div className="min-h-screen space-y-6 pb-24">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
              <Store className="h-4 w-4" />
              Buisness Hub
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {businessName}
            </h1>

            <p className="mt-1 text-sm text-white/55">
              Your business activity, money and customers in one place.
            </p>
          </div>

          <Button
            onClick={() => setShowSaleForm(true)}
            className="h-12 rounded-xl bg-white text-black hover:bg-white/90"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Sale
          </Button>
        </div>
      </section>

      <BusinessNav
        customersHref={`/${locale}/business/customers`}
        onAddSale={() => setShowSaleForm(true)}
        onAddPurchase={() => setShowPurchaseForm(true)}
      />

      <section id="business-dashboard" className="scroll-mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month", "custom"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => option === "custom" ? setPeriod("custom") : selectPeriod(option)}
              className={`rounded-lg px-3 py-2 text-sm transition ${period === option ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              {{ today: "Today", week: "This Week", month: "This Month", custom: "Custom Range" }[option]}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Input aria-label="Start date" type="date" value={dateRange.startDate} onChange={(event) => setDateRange((range) => ({ ...range, startDate: event.target.value }))} className="h-10 border-white/10 bg-white/[0.04] text-white" />
            <span>to</span>
            <Input aria-label="End date" type="date" value={dateRange.endDate} onChange={(event) => setDateRange((range) => ({ ...range, endDate: event.target.value }))} className="h-10 border-white/10 bg-white/[0.04] text-white" />
          </div>
        )}
      </section>

      {/* Main Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Sales"
          value={money(dashboard.data?.total_sales)}
          icon={<ArrowUpRight className="h-5 w-5" />}
          loading={isBusy}
        />

        <StatCard
          title="Purchases"
          value={money(dashboard.data?.total_purchases)}
          icon={<ArrowDownLeft className="h-5 w-5" />}
          loading={isBusy}
        />

        <StatCard
          title="Estimated Profit"
          value={money(dashboard.data?.estimated_profit)}
          icon={<CircleDollarSign className="h-5 w-5" />}
          loading={isBusy}
          highlight
        />

        <StatCard
          title="Customer Due"
          value={money(dashboard.data?.customer_due)}
          icon={<Wallet className="h-5 w-5" />}
          loading={isBusy}
          warning
        />
      </section>

      {/* Secondary Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          icon={<Users className="h-4 w-4" />}
          label="Customers"
          value={dashboard.data?.customer_count ?? 0}
        />

        <MiniStat
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Transactions"
          value={dashboard.data?.transaction_count ?? 0}
        />

        <MiniStat
          icon={<Package className="h-4 w-4" />}
          label="Date range"
          value={`${dateRange.startDate.slice(5)} – ${dateRange.endDate.slice(5)}`}
        />

        <MiniStat
          icon={<IndianRupee className="h-4 w-4" />}
          label="Profit margin"
          value={`${dashboard.data?.total_sales ? ((dashboard.data.estimated_profit / dashboard.data.total_sales) * 100).toFixed(1) : "0.0"}%`}
        />
      </section>

      <section id="business-trends" className="scroll-mt-4 grid gap-3 lg:grid-cols-2">
        <DashboardChart title="Sales trend" color="#22d3ee" data={dashboard.data?.trend ?? []} dataKey="sales" />
        <DashboardChart title="Purchase trend" color="#a78bfa" data={dashboard.data?.trend ?? []} dataKey="purchases" />
        <DashboardChart title="Profit trend" color="#34d399" data={dashboard.data?.trend ?? []} dataKey="profit" />
        <DashboardChart title="Due trend" color="#fbbf24" data={dashboard.data?.trend ?? []} dataKey="due" />
      </section>

      <section id="profit-analysis" className="scroll-mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold text-white">
              <BarChart3 className="h-5 w-5 text-emerald-300" /> Profit Analysis
            </div>
            <p className="mt-1 text-sm text-white/45">Compare profit over time from your sales and purchases.</p>
          </div>
          <div className="flex rounded-lg bg-white/5 p-1">
            {(["weekly", "monthly"] as const).map((option) => (
              <button key={option} type="button" onClick={() => setProfitGranularity(option)} className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${profitGranularity === option ? "bg-white text-black" : "text-white/55 hover:text-white"}`}>{option}</button>
            ))}
          </div>
        </div>
        <ProfitAnalysisChart data={profitTrend} loading={profitAnalysis.isLoading} />
      </section>

      <section id="profit-ideas" className="scroll-mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.045] p-4 backdrop-blur-xl sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-300" />
          <div>
            <h2 className="font-semibold text-white">AI Profit Ideas</h2>
            <p className="text-sm text-white/45">Based on your last 30 days of recorded sales and purchase costs.</p>
          </div>
        </div>
        {profitIdeas.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {(profitIdeas.data?.ideas ?? []).map((idea) => (
              <article key={idea.title} className="rounded-xl border border-white/10 bg-black/10 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-medium text-white">{idea.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${idea.priority === "high" ? "bg-rose-400/10 text-rose-200" : idea.priority === "medium" ? "bg-amber-400/10 text-amber-200" : "bg-cyan-400/10 text-cyan-200"}`}>{idea.priority}</span>
                </div>
                <p className="text-sm leading-6 text-white/55">{idea.reason}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">
            Quick Actions
          </h2>
          <p className="text-sm text-white/45">
            Keep your daily business records simple.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            icon={<Plus className="h-5 w-5" />}
            title="Add Sale"
            description="Record today's sale"
            onClick={() => setShowSaleForm(true)}
          />

          <Link
            href={`/${locale}/business/customers`}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 transition group-hover:bg-white/10 group-hover:text-white">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-white">Customers</p>
              <p className="mt-0.5 text-xs text-white/40">{customers.length} customers</p>
            </div>
            <ChevronDown className="ml-auto h-4 w-4 rotate-[-90deg] text-white/20 transition group-hover:text-white/50" />
          </Link>

          <QuickAction
            icon={<Package className="h-5 w-5" />}
            title="Add Purchase"
            description="Record stock or supplies"
            onClick={() => setShowPurchaseForm(true)}
          />

          <QuickAction
            icon={<Store className="h-5 w-5" />}
            title="Business Profile"
            description="Update business details"
            onClick={() => setShowProfile((value) => !value)}
          />
        </div>
      </section>

      {/* Profile */}
      {showProfile && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">
                Business Profile
              </h2>
              <p className="text-sm text-white/45">
                Your saved business information.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowProfile(false)}
              className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField
              label="Business name"
              value={profile?.business_name}
            />
            <InfoField
              label="Business type"
              value={profile?.business_type}
            />
            <InfoField
              label="Category"
              value={profile?.business_category}
            />
            <InfoField
              label="Location"
              value={
                [
                  profile?.village,
                  profile?.district,
                  profile?.state,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not added"
              }
            />
            <InfoField
              label="Main products"
              value={profile?.main_products}
            />
            <InfoField
              label="Workers"
              value={
                profile?.workers_count !== undefined
                  ? String(profile.workers_count)
                  : undefined
              }
            />
          </div>
        </section>
      )}

      {/* Recent Sales */}
      <section id="business-sales" className="scroll-mt-4 rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <h2 className="font-semibold text-white">
              Recent Sales
            </h2>
            <p className="text-sm text-white/45">
              Your latest customer transactions.
            </p>
          </div>

          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">
            {sales.length} shown
          </span>
        </div>

        {sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <ShoppingBag className="h-6 w-6 text-white/35" />
            </div>

            <h3 className="font-medium text-white">
              No sales recorded yet
            </h3>

            <p className="mt-1 max-w-sm text-sm text-white/45">
              Add your first sale and FinCompass will start
              building your business picture.
            </p>

            <Button
              onClick={() => setShowSaleForm(true)}
              className="mt-5 rounded-xl"
              variant="secondary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add First Sale
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between gap-4 p-4 transition hover:bg-white/[0.025] sm:p-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">
                    {sale.customer_name || "Walk-in customer"}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40">
                    <span>
                      {sale.items?.length
                        ? sale.items.map((item) => item.name || "Item").join(", ")
                        : "Quick sale"}
                    </span>
                    <span>{sale.payment_method}</span>
                    <span>{formatDate(sale.date)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-semibold text-white">
                    {money(sale.total_amount)}
                  </p>

                  {sale.due_amount > 0 ? (
                    <p className="text-xs text-amber-300">
                      {money(sale.due_amount)} due
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-300">
                      Paid
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Sale Modal */}
      {showSaleForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[calc(100vh-5rem)] w-full overflow-y-auto rounded-3xl border border-white/10 bg-[#101116] shadow-2xl sm:max-h-[92vh] sm:max-w-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#101116]/95 p-5 backdrop-blur-xl">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Add Sale
                </h2>
                <p className="text-sm text-white/45">
                  Enter only what you know.
                </p>
              </div>

              <button
                type="button"
                onClick={closeSaleForm}
                className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Mode */}
              <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setDetailedMode(false)}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    !detailedMode
                      ? "bg-white text-black"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  Quick Sale
                </button>

                <button
                  type="button"
                  onClick={() => setDetailedMode(true)}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    detailedMode
                      ? "bg-white text-black"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  Add Items
                </button>
              </div>

              {/* Quick amount */}
              {!detailedMode && (
                <div>
                  <label className="mb-2 block text-white/70">
                    Total Amount *
                  </label>

                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />

                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="500"
                      value={amount}
                      onChange={(event) =>
                        setAmount(event.target.value)
                      }
                      className="h-14 border-white/10 bg-white/[0.04] pl-11 text-xl text-white placeholder:text-white/20"
                    />
                  </div>
                </div>
              )}

              {/* Items */}
              {detailedMode && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-white/70">
                      Items
                    </label>

                    <button
                      type="button"
                      onClick={addItem}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-cyan-300 hover:bg-cyan-400/10"
                    >
                      <Plus className="h-4 w-4" />
                      Add another item
                    </button>
                  </div>

                  {items.map((item, index) => {
                    const lineTotal =
                      Number(item.quantity || 0) *
                      Number(item.unit_price || 0);

                    return (
                      <div
                        key={index}
                        className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-medium uppercase tracking-wider text-white/35">
                            Item {index + 1}
                          </span>

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(index)
                              }
                              className="text-xs text-red-300 hover:text-red-200"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Input
                              placeholder="Item name — Rice"
                              value={item.name}
                              onChange={(event) =>
                                updateItem(
                                  index,
                                  "name",
                                  event.target.value,
                                )
                              }
                              className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/20"
                            />
                          </div>

                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="Quantity"
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "quantity",
                                event.target.value,
                              )
                            }
                            className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/20"
                          />

                          <Input
                            placeholder="Unit — kg"
                            value={item.unit}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "unit",
                                event.target.value,
                              )
                            }
                            className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/20"
                          />

                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="Price per unit"
                            value={item.unit_price}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "unit_price",
                                event.target.value,
                              )
                            }
                            className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/20"
                          />

                          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3">
                            <span className="text-xs text-white/40">
                              Item total
                            </span>
                            <span className="font-medium text-white">
                              {money(lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Customer */}
              <div>
                <label className="mb-2 block text-white/70">
                  Customer{" "}
                  <span className="text-white/30">
                    (optional)
                  </span>
                </label>

                <Input
                  list="business-customers"
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(event) =>
                    setCustomerName(event.target.value)
                  }
                  className="h-12 border-white/10 bg-white/[0.04] text-white placeholder:text-white/20"
                />

                <datalist id="business-customers">
                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.name}
                    />
                  ))}
                </datalist>
              </div>

              {/* Payment */}
              <div>
                <label className="mb-2 block text-white/70">
                  Payment
                </label>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["cash", "Cash"],
                    ["upi", "UPI"],
                    ["card", "Card"],
                    ["credit", "Credit"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() =>
                        setPaymentMethod(value)
                      }
                      className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                        paymentMethod === value
                          ? "border-white bg-white text-black"
                          : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paid amount */}
              {paymentMethod === "credit" && (
                <div>
                  <label className="mb-2 block text-white/70">
                    Amount Paid
                  </label>

                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={paidAmount}
                    onChange={(event) =>
                      setPaidAmount(event.target.value)
                    }
                    className="h-12 border-white/10 bg-white/[0.04] text-white placeholder:text-white/20"
                  />
                </div>
              )}

              {/* Total */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">
                    Total
                  </span>

                  <span className="text-2xl font-bold text-white">
                    {money(calculatedTotal)}
                  </span>
                </div>

                {paymentMethod === "credit" && (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/45">
                        Paid
                      </span>
                      <span className="text-white">
                        {money(paid)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-amber-300">
                        Due
                      </span>
                      <span className="font-semibold text-amber-300">
                        {money(due)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-white/70">
                  Notes{" "}
                  <span className="text-white/30">
                    (optional)
                  </span>
                </label>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  placeholder="Anything you want to remember..."
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/25"
                />
              </div>

              {/* Error */}
              {createSale.isError && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  {saleErrorMessage(createSale.error)}
                </div>
              )}

              {/* Save */}
              <Button
                type="button"
                onClick={handleCreateSale}
                disabled={
                  createSale.isPending ||
                  calculatedTotal <= 0 ||
                  paid > calculatedTotal
                }
                className="h-13 w-full rounded-xl bg-white text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="mr-2 h-5 w-5" />
                {createSale.isPending
                  ? "Saving..."
                  : "Save Sale"}
              </Button>

              <p className="text-center text-xs text-white/30">
                You can start with just the amount. More details
                are optional.
              </p>
            </div>
          </div>
        </div>
      )}

      {showPurchaseForm && (
        <PurchaseEntryDialog
          onClose={() => setShowPurchaseForm(false)}
          onSave={async (body) => {
            await createPurchase.mutateAsync(body);
            setShowPurchaseForm(false);
          }}
          isSaving={createPurchase.isPending}
          error={createPurchase.error}
        />
      )}
    </div>
  );
}

function BusinessNav({
  customersHref,
  onAddSale,
  onAddPurchase,
}: {
  customersHref: string;
  onAddSale: () => void;
  onAddPurchase: () => void;
}) {
  const navClass = "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white";
  return (
    <nav aria-label="Buisness Hub navigation" className="sticky top-0 z-20 -mx-1 overflow-x-auto rounded-xl border border-white/10 bg-[#101116]/90 p-1.5 shadow-xl backdrop-blur-xl">
      <div className="flex min-w-max items-center gap-1">
        <a href="#business-dashboard" className={navClass}><ChartNoAxesCombined className="h-4 w-4" /> Dashboard</a>
        <a href="#business-sales" className={navClass}><ShoppingBag className="h-4 w-4" /> Sales</a>
        <button type="button" onClick={onAddPurchase} className={navClass}><Package className="h-4 w-4" /> Purchases</button>
        <Link href={customersHref} className={navClass}><Users className="h-4 w-4" /> Customers</Link>
        <a href="#profit-analysis" className={navClass}><BarChart3 className="h-4 w-4" /> Profit Analysis</a>
        <a href="#profit-ideas" className={navClass}><Sparkles className="h-4 w-4" /> AI Ideas</a>
        <Button onClick={onAddSale} size="sm" className="ml-1 rounded-lg bg-white text-black hover:bg-white/90"><Plus className="mr-1 h-4 w-4" /> Add Sale</Button>
      </div>
    </nav>
  );
}

function PurchaseEntryDialog({
  onClose,
  onSave,
  isSaving,
  error,
}: {
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
  error: unknown;
}) {
  const [itemized, setItemized] = useState(true);
  const [amount, setAmount] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [items, setItems] = useState<SaleItem[]>([emptyItem()]);
  const [formError, setFormError] = useState("");
  const total = itemized
    ? items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)
    : Number(amount || 0);

  function updateItem(index: number, field: keyof SaleItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  async function savePurchase() {
    const validItems = items
      .filter((item) => item.name.trim() && Number(item.quantity) > 0 && Number(item.unit_price) >= 0)
      .map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity), unit: item.unit.trim() || "unit", unit_price: Number(item.unit_price) }));
    if (itemized && validItems.length === 0) {
      setFormError("Add at least one item with a quantity and cost.");
      return;
    }
    if (!itemized && total <= 0) {
      setFormError("Enter a purchase amount.");
      return;
    }
    setFormError("");
    await onSave(itemized
      ? { items: validItems, supplier_name: supplierName.trim() || undefined }
      : { amount: total, supplier_name: supplierName.trim() || undefined });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-3 pb-3 pt-16 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[calc(100vh-5rem)] w-full overflow-y-auto rounded-3xl border border-white/10 bg-[#101116] shadow-2xl sm:max-h-[92vh] sm:max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#101116]/95 p-5 backdrop-blur-xl">
          <div><h2 className="text-xl font-semibold text-white">Add Purchase</h2><p className="text-sm text-white/45">Record stock, supplies or other business costs.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button type="button" onClick={() => setItemized(false)} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium ${!itemized ? "bg-white text-black" : "text-white/55"}`}>Quick Amount</button>
            <button type="button" onClick={() => setItemized(true)} className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium ${itemized ? "bg-white text-black" : "text-white/55"}`}>Add Items</button>
          </div>
          <Input placeholder="Supplier name (optional)" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className="border-white/10 bg-white/[0.04] text-white" />
          {!itemized ? (
            <div><label className="mb-2 block text-white/70">Total Purchase Amount *</label><Input type="number" inputMode="decimal" placeholder="e.g. 2500" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-14 border-white/10 bg-white/[0.04] text-xl text-white" /></div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><label className="text-white/70">Items purchased</label><button type="button" onClick={() => setItems((current) => [...current, emptyItem()])} className="text-sm text-cyan-300">+ Add another item</button></div>
              {items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-4">
                  <Input placeholder="Item name" value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} className="sm:col-span-2 border-white/10 bg-white/[0.04] text-white" />
                  <Input type="number" placeholder="Quantity" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} className="border-white/10 bg-white/[0.04] text-white" />
                  <Input type="number" placeholder="Cost / unit" value={item.unit_price} onChange={(event) => updateItem(index, "unit_price", event.target.value)} className="border-white/10 bg-white/[0.04] text-white" />
                  <Input placeholder="Unit (kg, pack)" value={item.unit} onChange={(event) => updateItem(index, "unit", event.target.value)} className="border-white/10 bg-white/[0.04] text-white" />
                  <p className="self-center text-right text-sm text-white/60">{money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</p>
                  {items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-sm text-red-300">Remove</button>}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-4"><span className="text-white/55">Total purchase</span><span className="text-2xl font-bold text-white">{money(total)}</span></div>
          {!!(formError || error) && <p className="text-sm text-red-300">{formError || (error ? saleErrorMessage(error) : "")}</p>}
          <Button onClick={savePurchase} disabled={isSaving} className="h-12 w-full rounded-xl bg-white text-black hover:bg-white/90">{isSaving ? "Saving..." : "Save Purchase"}</Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  loading,
  highlight,
  warning,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  loading?: boolean;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium text-white/45 sm:text-sm">
          {title}
        </span>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            warning
              ? "bg-amber-400/10 text-amber-300"
              : highlight
                ? "bg-emerald-400/10 text-emerald-300"
                : "bg-white/5 text-white/45"
          }`}
        >
          {icon}
        </div>
      </div>

      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded-lg bg-white/10" />
      ) : (
        <p className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          {value}
        </p>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/45">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="truncate text-xs text-white/40">
          {label}
        </p>
        <p className="font-semibold text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 transition group-hover:bg-white/10 group-hover:text-white">
        {icon}
      </div>

      <div>
        <p className="font-medium text-white">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-white/40">
          {description}
        </p>
      </div>

      <ChevronDown className="ml-auto h-4 w-4 rotate-[-90deg] text-white/20 transition group-hover:text-white/50" />
    </button>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="text-xs text-white/35">
        {label}
      </p>
      <p className="mt-1 text-sm text-white/80">
        {value || "Not added"}
      </p>
    </div>
  );
}

function DashboardChart({
  title,
  color,
  data,
  dataKey,
}: {
  title: string;
  color: string;
  data: Array<{ date: string; sales: number; purchases: number; profit: number; due: number }>;
  dataKey: "sales" | "purchases" | "profit" | "due";
}) {
  return (
    <div className="h-64 rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl">
      <h2 className="mb-3 font-semibold text-white">{title}</h2>
      {data.length === 0 ? (
        <div className="flex h-[190px] items-center justify-center text-sm text-white/40">
          No activity in this period yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id={`dashboard-${dataKey}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(value) => `₹${value}`} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              labelFormatter={(value) => formatDate(String(value))}
              formatter={(value) => money(Number(value))}
              contentStyle={{ background: "#17181d", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, color: "white" }}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#dashboard-${dataKey})`} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function ProfitAnalysisChart({
  data,
  loading,
}: {
  data: Array<{ label: string; profit: number }>;
  loading: boolean;
}) {
  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-white/5" />;
  }
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-white/40">Record sales and purchases to see your profit trend.</div>;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id="profit-analysis" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={(value) => `₹${value}`} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
          <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#17181d", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, color: "white" }} />
          <Area type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2.5} fill="url(#profit-analysis)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}
