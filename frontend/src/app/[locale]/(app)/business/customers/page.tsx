"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { ArrowLeft, Plus, Search, UserRound, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useBusinessCustomers,
  useBusinessSales,
  useCreateBusinessCustomer,
} from "@/hooks/use-api";
import { ApiRequestError } from "@/lib/api";

type CustomerFilter = "all" | "paid" | "due";

function money(value: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

export default function CustomersPage() {
  const locale = useLocale();
  const { data: customers = [], isLoading } = useBusinessCustomers(1000);
  const { data: sales = [] } = useBusinessSales(1000);
  const createCustomer = useCreateBusinessCustomer();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const visibleCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery = !normalizedQuery || [customer.name, customer.phone, customer.address]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
      const matchesFilter = filter === "all"
        || (filter === "due" && customer.total_due > 0)
        || (filter === "paid" && customer.total_purchased > 0 && customer.total_due === 0);
      return matchesQuery && matchesFilter;
    });
  }, [customers, filter, query]);

  const salesByCustomer = useMemo(() => {
    const counts = new Map<number, number>();
    sales.forEach((sale) => {
      if (sale.customer_id !== null) counts.set(sale.customer_id, (counts.get(sale.customer_id) ?? 0) + 1);
    });
    return counts;
  }, [sales]);

  async function addCustomer() {
    if (!name.trim()) return;
    try {
      await createCustomer.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      setName("");
      setPhone("");
      setAddress("");
      setShowForm(false);
    } catch {
      // The API error is displayed below the form.
    }
  }

  return (
    <div className="min-h-screen space-y-6 pb-24">
      <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl backdrop-blur-xl sm:p-7">
        <Link href={`/${locale}/business`} className="mb-4 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Business Hub
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
              <UserRound className="h-4 w-4" /> Digital Khata
            </div>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">Customers</h1>
            <p className="mt-1 text-sm text-white/55">Track purchases, payments and outstanding balances.</p>
          </div>
          <Button onClick={() => setShowForm((open) => !open)} className="rounded-xl bg-white text-black hover:bg-white/90">
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        </div>
      </section>

      {showForm && (
        <section className="grid gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-4 sm:grid-cols-3">
          <Input placeholder="Customer name *" value={name} onChange={(event) => setName(event.target.value)} className="border-white/10 bg-white/[0.04] text-white" />
          <Input placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} className="border-white/10 bg-white/[0.04] text-white" />
          <Input placeholder="Address (optional)" value={address} onChange={(event) => setAddress(event.target.value)} className="border-white/10 bg-white/[0.04] text-white" />
          {createCustomer.isError && <p className="sm:col-span-2 text-sm text-red-300">{createCustomer.error instanceof ApiRequestError ? createCustomer.error.message : "Could not add this customer."}</p>}
          <Button onClick={addCustomer} disabled={createCustomer.isPending || !name.trim()} className="sm:col-start-3">{createCustomer.isPending ? "Saving..." : "Save Customer"}</Button>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer" className="border-white/10 bg-white/[0.04] pl-10 text-white" />
          </div>
          <div className="flex gap-2">
            {(["all", "paid", "due"] as const).map((option) => (
              <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-lg px-3 py-2 text-sm capitalize ${filter === option ? "bg-white text-black" : "bg-white/5 text-white/60 hover:text-white"}`}>{option}</button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-white/5" />
        ) : visibleCustomers.length === 0 ? (
          <div className="py-12 text-center text-sm text-white/45">No customers found. Add a customer or record a sale with a customer name.</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleCustomers.map((customer) => (
              <article key={customer.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-white">{customer.name}</h2>
                    <p className="mt-1 text-xs text-white/40">{customer.phone || customer.address || "No contact details"}</p>
                  </div>
                  {customer.total_due > 0 && <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">Due</span>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <Metric label="Purchased" value={money(customer.total_purchased)} />
                  <Metric label="Paid" value={money(customer.total_paid)} />
                  <Metric label="Due" value={money(customer.total_due)} warning={customer.total_due > 0} />
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-white/40"><Wallet className="h-3.5 w-3.5" /> {salesByCustomer.get(customer.id) ?? 0} transactions</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div><p className="text-xs text-white/35">{label}</p><p className={warning ? "mt-1 font-medium text-amber-300" : "mt-1 font-medium text-white"}>{value}</p></div>;
}
