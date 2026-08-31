"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Skeleton, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useBusinessProfile,
  useUpdateBusinessProfile,
} from "@/hooks/use-api";
import { ApiRequestError } from "@/lib/api";
import { Check, Store, Building2, MapPin, Users, Target, Sparkles, CheckCircle2 } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";
import { FinancialGlobe } from "@/components/3d/financial-globe";

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

const BUSINESS_CATEGORIES = [
  "agri",
  "food_processing",
  "handicrafts",
  "textiles",
  "retail",
  "services",
  "transportation",
  "dairy",
  "poultry",
  "fisheries",
] as const;

const BUSINESS_STAGES = ["idea", "starting", "growing", "stable", "expanding"] as const;

interface BusinessForm {
  business_name: string;
  business_type: string;
  business_category: string;
  business_stage: string;
  main_products: string;
  village: string;
  district: string;
  state: string;
  started_on: string;
  avg_monthly_sales: string;
  avg_monthly_expenses: string;
  monthly_income_estimate: string;
  workers_count: string;
  typical_customers: string;
  financial_goals: string;
  business_goals: string;
  seasonal: boolean;
  season_note: string;
}

const EMPTY_FORM: BusinessForm = {
  business_name: "",
  business_type: "",
  business_category: "",
  business_stage: "",
  main_products: "",
  village: "",
  district: "",
  state: "",
  started_on: "",
  avg_monthly_sales: "",
  avg_monthly_expenses: "",
  monthly_income_estimate: "",
  workers_count: "",
  typical_customers: "",
  financial_goals: "",
  business_goals: "",
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

  if (profile.data && !loaded) {
    const data = profile.data;
    setForm({
      business_name: data.business_name ?? "",
      business_type: data.business_type ?? "",
      business_category: data.business_category ?? "",
      business_stage: data.business_stage ?? "",
      main_products: data.main_products ?? "",
      village: data.village ?? "",
      district: data.district ?? "",
      state: data.state ?? "",
      started_on: data.started_on ?? "",
      avg_monthly_sales:
        data.avg_monthly_sales != null ? String(data.avg_monthly_sales) : "",
      avg_monthly_expenses:
        data.avg_monthly_expenses != null ? String(data.avg_monthly_expenses) : "",
      monthly_income_estimate:
        data.monthly_income_estimate != null ? String(data.monthly_income_estimate) : "",
      workers_count: data.workers_count != null ? String(data.workers_count) : "",
      typical_customers: data.typical_customers ?? "",
      financial_goals: (data.financial_goals ?? []).join(", "),
      business_goals: (data.business_goals ?? []).join(", "),
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
      business_category: form.business_category || null,
      business_stage: form.business_stage || null,
      main_products: form.main_products || null,
      village: form.village || null,
      district: form.district || null,
      state: form.state || null,
      started_on: form.started_on || null,
      avg_monthly_sales: form.avg_monthly_sales === "" ? null : Number(form.avg_monthly_sales),
      avg_monthly_expenses:
        form.avg_monthly_expenses === "" ? null : Number(form.avg_monthly_expenses),
      monthly_income_estimate:
        form.monthly_income_estimate === "" ? null : Number(form.monthly_income_estimate),
      workers_count: form.workers_count === "" ? null : Number(form.workers_count),
      typical_customers: form.typical_customers || null,
      financial_goals:
        form.financial_goals.trim() === ""
          ? null
          : form.financial_goals
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean),
      business_goals:
        form.business_goals.trim() === ""
          ? null
          : form.business_goals
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean),
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

  if (profile.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="ENTERPRISE PROFILE"
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant="cyan" pulse>GEO CONTEXT</SpatialBadge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side Form */}
        <div className="lg:col-span-8">
          <GlassPanel glow="cyan" hudCorners className="p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Store className="h-4 w-4 text-cyan-400" />
                <span>Enterprise Registry & Operations</span>
              </h3>
              <SpatialBadge variant="cyan">AUTO SYNC</SpatialBadge>
            </div>
            <p className="text-xs text-text-muted mb-6">{t("optionalNote")}</p>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-text-secondary">{t("businessName")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder={t("phBusinessName")} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("businessType")}</Label>
                <Select className="mt-1 bg-surface-container border-cyan-500/20" value={form.business_type} onChange={(e) => set("business_type", e.target.value)}>
                  <option value="">{t("selectType")}</option>
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{t(`type_${bt}`)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("businessCategory")}</Label>
                <Select className="mt-1 bg-surface-container border-cyan-500/20" value={form.business_category} onChange={(e) => set("business_category", e.target.value)}>
                  <option value="">{t("selectCategory")}</option>
                  {BUSINESS_CATEGORIES.map((bc) => (
                    <option key={bc} value={bc}>{t(`category_${bc}`)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("businessStage")}</Label>
                <Select className="mt-1 bg-surface-container border-cyan-500/20" value={form.business_stage} onChange={(e) => set("business_stage", e.target.value)}>
                  <option value="">{t("selectStage")}</option>
                  {BUSINESS_STAGES.map((bs) => (
                    <option key={bs} value={bs}>{t(`stage_${bs}`)}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-text-secondary">{t("mainProducts")}</Label>
                <Textarea className="mt-1 bg-surface-container border-cyan-500/20" rows={2} value={form.main_products} onChange={(e) => set("main_products", e.target.value)} placeholder={t("phMainProducts")} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("village")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.village} onChange={(e) => set("village", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("district")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.district} onChange={(e) => set("district", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("state")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.state} onChange={(e) => set("state", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("startedOn")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" type="date" value={form.started_on} onChange={(e) => set("started_on", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("avgMonthlySales")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" value={form.avg_monthly_sales} onChange={(e) => set("avg_monthly_sales", e.target.value)} placeholder={t("phAmount")} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("avgMonthlyExpenses")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" value={form.avg_monthly_expenses} onChange={(e) => set("avg_monthly_expenses", e.target.value)} placeholder={t("phAmount")} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-text-secondary">{t("monthlyIncomeEstimate")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" value={form.monthly_income_estimate} onChange={(e) => set("monthly_income_estimate", e.target.value)} placeholder={t("phAmount")} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-text-secondary">{t("financialGoals")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.financial_goals} onChange={(e) => set("financial_goals", e.target.value)} placeholder={t("phGoals")} />
                <p className="mt-1 text-[11px] text-text-muted">{t("goalsHint")}</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-text-secondary">{t("businessGoals")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.business_goals} onChange={(e) => set("business_goals", e.target.value)} placeholder={t("phGoals")} />
                <p className="mt-1 text-[11px] text-text-muted">{t("goalsHint")}</p>
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("workers")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="number" min="0" value={form.workers_count} onChange={(e) => set("workers_count", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("typicalCustomers")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.typical_customers} onChange={(e) => set("typical_customers", e.target.value)} placeholder={t("phCustomers")} />
              </div>
              <div className="sm:col-span-2 flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-surface-container/80 p-3.5">
                <div>
                  <Label className="text-xs font-semibold text-text-primary">{t("seasonal")}</Label>
                  <p className="text-[11px] text-text-muted mt-0.5">{t("seasonalDesc")}</p>
                </div>
                <Switch checked={form.seasonal} onCheckedChange={(v) => set("seasonal", v)} aria-label={t("seasonal")} />
              </div>
              {form.seasonal && (
                <div className="sm:col-span-2">
                  <Label className="text-xs text-text-secondary">{t("seasonNote")}</Label>
                  <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.season_note} onChange={(e) => set("season_note", e.target.value)} placeholder={t("phSeasonNote")} />
                </div>
              )}
              <div className="flex items-center gap-3 sm:col-span-2 mt-2">
                <Button
                  type="submit"
                  disabled={update.isPending}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
                >
                  {update.isPending ? "SAVING..." : tc("save")}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>{t("saved")}</span>
                  </span>
                )}
              </div>
            </form>
            {error && <p className="mt-3 text-xs font-mono text-rose-400">{error}</p>}
          </GlassPanel>
        </div>

        {/* Right Side 3D Spatial Context & Telemetry */}
        <div className="lg:col-span-4 space-y-4">
          <GlassPanel glow="cyan" hudCorners className="p-6 flex flex-col items-center justify-center text-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">Institutional Footprint</h4>
            <div className="my-2">
              <FinancialGlobe size={180} />
            </div>
            <p className="text-xs text-text-muted max-w-xs mt-1">
              Your profile unlocks AI-matched government subsidies, local enterprise schemes, and tailored borrowing limits.
            </p>
          </GlassPanel>

          <GlassPanel className="p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Security & Verification</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container border border-white/5">
                <span className="text-text-muted">State Jurisdiction</span>
                <span className="font-mono text-cyan-300 font-semibold">{form.state || "Not Set"}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container border border-white/5">
                <span className="text-text-muted">Enterprise Tier</span>
                <span className="font-mono text-cyan-300 font-semibold">{form.business_stage || "Early"}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container border border-white/5">
                <span className="text-text-muted">Data Privacy</span>
                <span className="font-mono text-emerald-400 font-semibold">AES-256 E2E</span>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
