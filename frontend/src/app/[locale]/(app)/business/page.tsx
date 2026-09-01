"use client";

import { useMemo, useState } from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  CircleDollarSign,
  IndianRupee,
  Package,
  Plus,
  Save,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  X,
} from "lucide-react";

import {
  useBusinessCustomers,
  useBusinessProfile,
  useBusinessSales,
  useBusinessSummary,
  useCreateBusinessSale,
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

export default function BusinessPage() {
  const { data: profile, isLoading: profileLoading } = useBusinessProfile();
  const { data: summary, isLoading: summaryLoading } = useBusinessSummary();
  const { data: sales = [], isLoading: salesLoading } = useBusinessSales(10);
  const { data: customers = [] } = useBusinessCustomers(100);

  const createSale = useCreateBusinessSale();

  const [showSaleForm, setShowSaleForm] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);

  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<SaleItem[]>([emptyItem()]);

  const [showProfile, setShowProfile] = useState(false);

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
    summaryLoading ||
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
              Business Hub
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

      {/* Main Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Total Sales"
          value={money(summary?.total_sales)}
          icon={<ArrowUpRight className="h-5 w-5" />}
          loading={isBusy}
        />

        <StatCard
          title="Total Purchases"
          value={money(summary?.total_purchases)}
          icon={<ArrowDownLeft className="h-5 w-5" />}
          loading={isBusy}
        />

        <StatCard
          title="Estimated Profit"
          value={money(summary?.estimated_profit)}
          icon={<CircleDollarSign className="h-5 w-5" />}
          loading={isBusy}
          highlight
        />

        <StatCard
          title="Customer Due"
          value={money(summary?.customer_due)}
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
          value={summary?.customer_count ?? 0}
        />

        <MiniStat
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Sales"
          value={summary?.sales_count ?? 0}
        />

        <MiniStat
          icon={<Package className="h-4 w-4" />}
          label="Purchases"
          value={summary?.purchase_count ?? 0}
        />

        <MiniStat
          icon={<IndianRupee className="h-4 w-4" />}
          label="Margin"
          value={`${Number(summary?.profit_margin || 0).toFixed(1)}%`}
        />
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction
            icon={<Plus className="h-5 w-5" />}
            title="Add Sale"
            description="Record today's sale"
            onClick={() => setShowSaleForm(true)}
          />

          <QuickAction
            icon={<Users className="h-5 w-5" />}
            title="Customers"
            description={`${customers.length} customers`}
            onClick={() => {}}
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
      <section className="rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">
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
                    <span>{sale.items?.length || 0} items</span>
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101116] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
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

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["cash", "Cash"],
                    ["upi", "UPI"],
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
