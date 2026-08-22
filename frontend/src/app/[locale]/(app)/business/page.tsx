"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Skeleton, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common/shared";
import {
  useBusinessProfile,
  useUpdateBusinessProfile,
} from "@/hooks/use-api";
import { ApiRequestError } from "@/lib/api";
import { Check, Store } from "lucide-react";

const BUSINESS_TYPES = [
  "agriculture",
  "dairy",
  "food",
  "retail",
  "handicrafts",
  "tailoring",
  "transportation",
  "repair",
  "manufacturing",
  "services",
  "livestock",
  "fishing",
  "other",
] as const;

interface BusinessForm {
  business_name: string;
  business_type: string;
  main_products: string;
  village: string;
  district: string;
  state: string;
  started_on: string;
  avg_monthly_sales: string;
  avg_monthly_expenses: string;
  workers_count: string;
  typical_customers: string;
  seasonal: boolean;
  season_note: string;
}

const EMPTY_FORM: BusinessForm = {
  business_name: "",
  business_type: "",
  main_products: "",
  village: "",
  district: "",
  state: "",
  started_on: "",
  avg_monthly_sales: "",
  avg_monthly_expenses: "",
  workers_count: "",
  typical_customers: "",
  seasonal: false,
  season_note: "",
};

export default function BusinessProfilePage() {
  const t = useTranslations("business");
  const tc = useTranslations("common");
  const profile = useBusinessProfile();
  const update = useUpdateBusinessProfile();
  const [form, setForm] = useState<BusinessForm>(EMPTY_FORM);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // One-time form hydration during render (React's "adjusting state when
  // props change" pattern) — avoids an effect that calls setState.
  if (profile.data && !loaded) {
    const data = profile.data;
    setForm({
      business_name: data.business_name ?? "",
      business_type: data.business_type ?? "",
      main_products: data.main_products ?? "",
      village: data.village ?? "",
      district: data.district ?? "",
      state: data.state ?? "",
      started_on: data.started_on ?? "",
      avg_monthly_sales:
        data.avg_monthly_sales != null ? String(data.avg_monthly_sales) : "",
      avg_monthly_expenses:
        data.avg_monthly_expenses != null ? String(data.avg_monthly_expenses) : "",
      workers_count: data.workers_count != null ? String(data.workers_count) : "",
      typical_customers: data.typical_customers ?? "",
      seasonal: data.seasonal ?? false,
      season_note: data.season_note ?? "",
    });
    setLoaded(true);
  }

  const set = <K extends keyof BusinessForm>(key: K, value: BusinessForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    const body: Record<string, unknown> = {
      business_name: form.business_name || null,
      business_type: form.business_type || null,
      main_products: form.main_products || null,
      village: form.village || null,
      district: form.district || null,
      state: form.state || null,
      started_on: form.started_on || null,
      avg_monthly_sales: form.avg_monthly_sales === "" ? null : Number(form.avg_monthly_sales),
      avg_monthly_expenses:
        form.avg_monthly_expenses === "" ? null : Number(form.avg_monthly_expenses),
      workers_count: form.workers_count === "" ? null : Number(form.workers_count),
      typical_customers: form.typical_customers || null,
      seasonal: form.seasonal,
      season_note: form.season_note || null,
    };
    try {
      await update.mutateAsync(body);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  if (profile.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-primary" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-text-muted mb-4 max-w-2xl">{t("optionalNote")}</p>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <div>
              <Label>{t("businessName")}</Label>
              <Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder={t("phBusinessName")} />
            </div>
            <div>
              <Label>{t("businessType")}</Label>
              <Select value={form.business_type} onChange={(e) => set("business_type", e.target.value)}>
                <option value="">{t("selectType")}</option>
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{t(`type_${bt}`)}</option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>{t("mainProducts")}</Label>
              <Textarea rows={2} value={form.main_products} onChange={(e) => set("main_products", e.target.value)} placeholder={t("phMainProducts")} />
            </div>
            <div>
              <Label>{t("village")}</Label>
              <Input value={form.village} onChange={(e) => set("village", e.target.value)} />
            </div>
            <div>
              <Label>{t("district")}</Label>
              <Input value={form.district} onChange={(e) => set("district", e.target.value)} />
            </div>
            <div>
              <Label>{t("state")}</Label>
              <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
            <div>
              <Label>{t("startedOn")}</Label>
              <Input type="date" value={form.started_on} onChange={(e) => set("started_on", e.target.value)} />
            </div>
            <div>
              <Label>{t("avgMonthlySales")}</Label>
              <Input type="number" min="0" value={form.avg_monthly_sales} onChange={(e) => set("avg_monthly_sales", e.target.value)} placeholder={t("phAmount")} />
            </div>
            <div>
              <Label>{t("avgMonthlyExpenses")}</Label>
              <Input type="number" min="0" value={form.avg_monthly_expenses} onChange={(e) => set("avg_monthly_expenses", e.target.value)} placeholder={t("phAmount")} />
            </div>
            <div>
              <Label>{t("workers")}</Label>
              <Input type="number" min="0" value={form.workers_count} onChange={(e) => set("workers_count", e.target.value)} />
            </div>
            <div>
              <Label>{t("typicalCustomers")}</Label>
              <Input value={form.typical_customers} onChange={(e) => set("typical_customers", e.target.value)} placeholder={t("phCustomers")} />
            </div>
            <div className="sm:col-span-2 flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-container px-3 py-2.5">
              <div>
                <Label className="mb-0.5">{t("seasonal")}</Label>
                <p className="text-[11px] text-text-muted">{t("seasonalDesc")}</p>
              </div>
              <Switch checked={form.seasonal} onCheckedChange={(v) => set("seasonal", v)} aria-label={t("seasonal")} />
            </div>
            {form.seasonal && (
              <div className="sm:col-span-2">
                <Label>{t("seasonNote")}</Label>
                <Input value={form.season_note} onChange={(e) => set("season_note", e.target.value)} placeholder={t("phSeasonNote")} />
              </div>
            )}
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={update.isPending}>{tc("save")}</Button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-income">
                  <Check className="h-4 w-4" />{t("saved")}
                </span>
              )}
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
