"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import {
  useExpensesMonthly,
  useDebts,
  useSavingsGoals,
  useCalculateEMI,
} from "@/hooks/use-api";
import { formatCurrency, toNumber, formatPercent, cn } from "@/lib/utils";
import {
  Activity, Lightbulb, Store, Calculator as CalcIcon, Package,
  TrendingDown, TrendingUp, ShieldAlert, Info, Plus, Trash2, Landmark, Sparkles,
} from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialMetric } from "@/components/spatial/spatial-metric";
import { SpatialBadge } from "@/components/spatial/spatial-badge";
import { AIOrb } from "@/components/3d/ai-orb";

type TabKey = "health" | "structure" | "plan" | "pricing" | "expand";

export default function BusinessAdvisoryPage() {
  const t = useTranslations("advisory");
  const tc = useTranslations("common");
  const period = format(new Date(), "yyyy-MM");

  const monthly = useExpensesMonthly(period);
  const debts = useDebts();
  const savings = useSavingsGoals();

  const [tab, setTab] = useState<TabKey>("health");

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Activity }> = [
    { key: "health", label: t("tabHealth"), icon: Activity },
    { key: "structure", label: t("tabStructure"), icon: ShieldAlert },
    { key: "plan", label: t("tabPlan"), icon: Store },
    { key: "pricing", label: t("tabPricing"), icon: CalcIcon },
    { key: "expand", label: t("tabExpand"), icon: Package },
  ];

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="ADVISORY MATRIX"
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex items-center gap-2">
            <AIOrb size={40} />
            <SpatialBadge variant="cyan" pulse>NEURAL ENGINE</SpatialBadge>
          </div>
        }
      />

      {/* Futuristic Command Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-surface-card/60 border border-cyan-500/20 backdrop-blur-xl">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer",
              tab === key
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,242,254,0.2)]"
                : "text-text-muted hover:text-text-primary hover:bg-white/[0.04] border border-transparent",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", tab === key ? "text-cyan-400" : "text-text-muted")} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === "health" && <HealthSection monthly={monthly.data} loading={monthly.isLoading} />}
      {tab === "structure" && (
        <StructureSection
          monthly={monthly.data}
          loading={monthly.isLoading}
          debtPayments={debts.data?.reduce((s, d) => s + toNumber(d.monthly_payment), 0) ?? 0}
          savingsTotal={savings.data?.reduce((s, g) => s + toNumber(g.current_amount), 0) ?? 0}
        />
      )}
      {tab === "plan" && <PlanIdeaSection />}
      {tab === "pricing" && <PricingSection />}
      {tab === "expand" && (
        <ExpandSection
          netCashFlow={monthly.data ? toNumber(monthly.data.net_cash_flow) : null}
          loading={monthly.isLoading}
        />
      )}

      <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted/60">
        {tc("estimateLabel")} · {tc("forecastDisclaimer")}
      </p>
    </div>
  );
}

type MonthlyData = {
  total_income?: string;
  total_expenses?: string;
  net_cash_flow?: string;
  transaction_count?: number;
  categories?: Record<string, string>;
  change_percent?: number;
};

function HealthSection({ monthly, loading }: { monthly?: MonthlyData; loading: boolean }) {
  const t = useTranslations("advisory");
  const income = monthly ? toNumber(monthly.total_income) : 0;
  const expenses = monthly ? toNumber(monthly.total_expenses) : 0;
  const profit = monthly ? toNumber(monthly.net_cash_flow) : 0;
  const count = monthly?.transaction_count ?? 0;

  const topCategories = useMemo(() => {
    if (!monthly?.categories) return [] as Array<{ name: string; amount: number; share: number }>;
    const entries = Object.entries(monthly.categories)
      .map(([name, v]) => ({ name, amount: toNumber(v) }))
      .filter((e) => e.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const total = expenses || entries.reduce((s, e) => s + e.amount, 0);
    return entries.slice(0, 4).map((e) => ({ ...e, share: total > 0 ? (e.amount / total) * 100 : 0 }));
  }, [monthly, expenses]);

  const findings: string[] = [];
  if (count > 0) {
    findings.push(
      profit >= 0
        ? t("findingProfitPositive", { amount: formatCurrency(profit) })
        : t("findingProfitNegative", { amount: formatCurrency(Math.abs(profit)) }),
    );
    if (monthly?.change_percent != null) {
      findings.push(t("findingExpenseChange", { percent: formatPercent(toNumber(monthly.change_percent)) }));
    }
    const biggest = topCategories[0];
    if (biggest && biggest.share > 50) {
      findings.push(t("findingConcentration", { category: biggest.name, percent: `${biggest.share.toFixed(0)}%` }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpatialMetric label={t("revenue")} value={loading ? "" : formatCurrency(income)} subtitle={t("thisMonth")} icon={TrendingUp} loading={loading} glow="cyan" />
        <SpatialMetric label={t("expenses")} value={loading ? "" : formatCurrency(expenses)} subtitle={t("thisMonth")} icon={TrendingDown} loading={loading} glow="indigo" />
        <SpatialMetric label={t("profit")} value={loading ? "" : formatCurrency(profit)} subtitle={profit >= 0 ? t("keptThisMonth") : t("spentMoreThanEarned")} icon={CalcIcon} loading={loading} glow={profit >= 0 ? "emerald" : "rose"} />
        <SpatialMetric label={t("transactions")} value={String(count)} subtitle={t("recordedThisMonth")} icon={Activity} loading={loading} glow="cyan" />
      </div>

      <GlassPanel glow="cyan" hudCorners className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>{t("whatFinaiSees")}</span>
          </h3>
          <SpatialBadge variant="cyan">{t("basedOnYourData")}</SpatialBadge>
        </div>

        <div className="mt-4">
          {loading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : count === 0 ? (
            <p className="text-sm text-text-muted">{t("noTransactionsYet")}</p>
          ) : (
            <ul className="space-y-2">
              {findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-xl bg-surface-container/80 border border-white/5 px-3.5 py-2.5 text-xs text-text-secondary leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_6px_#00f2fe]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GlassPanel>

      {topCategories.length > 0 && (
        <GlassPanel className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">{t("topCategories")}</h3>
          <div className="space-y-2.5">
            {topCategories.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs p-2 rounded-xl bg-surface-container/50 border border-white/5">
                <span className="capitalize text-text-secondary font-medium">{c.name}</span>
                <span className="font-mono font-bold tabular-nums text-text-primary">
                  {formatCurrency(c.amount)} · <span className="text-cyan-400">{formatPercent(c.share, 0)}</span>
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

function StructureSection({
  monthly, loading, debtPayments, savingsTotal,
}: {
  monthly?: MonthlyData; loading: boolean; debtPayments: number; savingsTotal: number;
}) {
  const t = useTranslations("advisory");
  const income = monthly ? toNumber(monthly.total_income) : 0;
  const expenses = monthly ? toNumber(monthly.total_expenses) : 0;
  const surplus = income - expenses - debtPayments;

  const reserveMonths = expenses > 0 && savingsTotal > 0 ? savingsTotal / expenses : null;
  const reserveLabel =
    reserveMonths == null
      ? t("notEnoughData")
      : reserveMonths >= 1
        ? t("reserveMonths", { months: reserveMonths.toFixed(1) })
        : t("reserveDays", { days: Math.max(1, Math.round(reserveMonths * 30)) });

  const rows = [
    {
      title: t("workingCapitalTitle"),
      body: expenses > 0 ? t("workingCapitalBody", { amount: formatCurrency(Math.ceil(expenses / 4)) }) : t("notEnoughData"),
    },
    {
      title: t("emergencyReserveTitle"),
      body: reserveLabel,
    },
    {
      title: t("loanCapacityTitle"),
      body:
        income > 0
          ? surplus > 0
            ? t("loanCapacityOk", { amount: formatCurrency(surplus) })
            : t("loanCapacityRisky")
          : t("notEnoughData"),
    },
    {
      title: t("separateSavingsTitle"),
      body: t("separateSavingsBody"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SpatialMetric label={t("monthlySurplus")} value={loading ? "" : formatCurrency(surplus)} subtitle={t("afterAllCosts")} icon={TrendingUp} loading={loading} glow="cyan" />
        <SpatialMetric label={t("debtPayments")} value={loading ? "" : formatCurrency(debtPayments)} subtitle={t("perMonth")} icon={Landmark} loading={loading} glow="rose" />
        <SpatialMetric label={t("reserveBalance")} value={loading ? "" : formatCurrency(savingsTotal)} subtitle={t("inGoals")} icon={ShieldAlert} loading={loading} glow="emerald" />
      </div>

      <GlassPanel glow="cyan" className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Info className="h-4 w-4 text-cyan-400" />
            <span>{t("structureTitle")}</span>
          </h3>
          <SpatialBadge variant="cyan">{t("basedOnYourData")}</SpatialBadge>
        </div>
        <div className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <div key={r.title} className="rounded-xl border border-white/5 bg-surface-container/60 p-3.5">
              <p className="text-xs font-bold text-text-primary uppercase tracking-wider">{r.title}</p>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

interface PlanItem {
  id: number;
  label: string;
  amount: number;
}

function PlanIdeaSection() {
  const t = useTranslations("advisory");
  const [ideaName, setIdeaName] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [itemLabel, setItemLabel] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [monthlyOperating, setMonthlyOperating] = useState("");
  const [expectedRevenue, setExpectedRevenue] = useState("");

  const initialCapital = items.reduce((s, i) => s + (Number.isFinite(i.amount) ? i.amount : 0), 0);
  const opCost = Number(monthlyOperating) || 0;
  const revenue = Number(expectedRevenue) || 0;
  const monthlyProfit = revenue - opCost;
  const firstMonthCash = initialCapital + opCost;
  const breakEvenMonths = monthlyProfit > 0 && initialCapital > 0 ? initialCapital / monthlyProfit : null;

  const addItem = () => {
    const amt = Number(itemAmount);
    if (!itemLabel.trim() || !Number.isFinite(amt) || amt <= 0) return;
    setItems((list) => [...list, { id: Date.now(), label: itemLabel.trim(), amount: amt }]);
    setItemLabel("");
    setItemAmount("");
  };

  return (
    <div className="space-y-4">
      <GlassPanel hudCorners className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-4 flex items-center gap-2">
          <Store className="h-4 w-4 text-cyan-400" />
          <span>{t("planInputs")}</span>
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-text-secondary">{t("ideaName")}</Label>
            <Input className="mt-1 bg-surface-container border-cyan-500/20" value={ideaName} onChange={(e) => setIdeaName(e.target.value)} placeholder={t("phIdeaName")} />
          </div>

          <div>
            <Label className="text-xs text-text-secondary">{t("startupItems")}</Label>
            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <Input className="flex-1 bg-surface-container border-cyan-500/20" value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} placeholder={t("phItemLabel")} />
              <Input className="sm:w-36 bg-surface-container border-cyan-500/20" type="number" min="0" value={itemAmount} onChange={(e) => setItemAmount(e.target.value)} placeholder={t("phAmount")} />
              <Button type="button" variant="outline" className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10" onClick={addItem} aria-label={t("addItem")}>
                <Plus className="h-4 w-4" />{t("addItem")}
              </Button>
            </div>
            {items.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-xl bg-surface-container border border-white/5 px-3 py-2 text-xs">
                    <span className="text-text-secondary">{i.label}</span>
                    <span className="flex items-center gap-2 font-mono font-bold tabular-nums text-text-primary">
                      {formatCurrency(i.amount)}
                      <button
                        type="button"
                        onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
                        className="text-text-muted hover:text-rose-400 transition-colors"
                        aria-label={`${t("remove")} ${i.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-text-secondary">{t("monthlyOperating")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" value={monthlyOperating} onChange={(e) => setMonthlyOperating(e.target.value)} placeholder={t("phAmount")} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("expectedRevenue")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" value={expectedRevenue} onChange={(e) => setExpectedRevenue(e.target.value)} placeholder={t("phExpected")} />
            </div>
          </div>
          <p className="text-[11px] text-text-muted font-mono">{t("planAssumptionNote")}</p>
        </div>
      </GlassPanel>

      {(items.length > 0 || opCost > 0 || revenue > 0) && (
        <GlassPanel glow="cyan" className="p-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("planResults")}{ideaName ? ` — ${ideaName}` : ""}</h3>
            <SpatialBadge variant="cyan">{t("yourEstimate")}</SpatialBadge>
          </div>
          <div className="space-y-2 text-sm">
            <Row label={t("initialCapital")} value={formatCurrency(initialCapital)} />
            <Row label={t("firstMonthCash")} value={formatCurrency(firstMonthCash)} hint={t("firstMonthCashHint")} />
            <Row label={t("monthlyProfitEstimate")} value={formatCurrency(monthlyProfit)} tone={monthlyProfit >= 0 ? "positive" : "negative"} />
            <Row
              label={t("breakEven")}
              value={breakEvenMonths == null ? t("breakEvenNA") : breakEvenMonths <= 1 ? t("withinAMonth") : t("monthsToBreakEven", { count: breakEvenMonths.toFixed(1) })}
            />
            {monthlyProfit <= 0 && revenue > 0 && (
              <Warning text={t("warningNoMargin")} />
            )}
            {breakEvenMonths != null && breakEvenMonths > 12 && (
              <Warning text={t("warningSlowPayback")} />
            )}
            <p className="pt-2 text-[10px] font-mono uppercase tracking-wider text-text-muted/60">{t("estimateDisclaimer")}</p>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

function PricingSection() {
  const t = useTranslations("advisory");
  const [unitCost, setUnitCost] = useState("");
  const [otherUnitCost, setOtherUnitCost] = useState("");
  const [overheads, setOverheads] = useState("");
  const [unitsPerMonth, setUnitsPerMonth] = useState("");
  const [margin, setMargin] = useState("20");

  const cost = Number(unitCost) || 0;
  const other = Number(otherUnitCost) || 0;
  const overhead = Number(overheads) || 0;
  const units = Number(unitsPerMonth) || 0;
  const marginPct = Math.min(300, Math.max(0, Number(margin) || 0));

  const overheadPerUnit = units > 0 ? overhead / units : 0;
  const totalUnitCost = cost + other + overheadPerUnit;
  const suggestedPrice = totalUnitCost * (1 + marginPct / 100);
  const profitPerUnit = suggestedPrice - totalUnitCost;
  const monthlyProfit = profitPerUnit * units;
  const hasAny = cost > 0 || other > 0 || overhead > 0;

  return (
    <div className="space-y-4">
      <GlassPanel hudCorners className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-4 flex items-center gap-2">
          <CalcIcon className="h-4 w-4 text-cyan-400" />
          <span>{t("pricingInputs")}</span>
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-text-secondary">{t("costPerUnit")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder={t("phAmount")} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("otherUnitCost")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" value={otherUnitCost} onChange={(e) => setOtherUnitCost(e.target.value)} placeholder={t("phPackaging")} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("monthlyOverheads")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" value={overheads} onChange={(e) => setOverheads(e.target.value)} placeholder={t("phOverheads")} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("unitsPerMonth")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" value={unitsPerMonth} onChange={(e) => setUnitsPerMonth(e.target.value)} placeholder={t("phUnits")} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("targetMargin")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" max="300" value={margin} onChange={(e) => setMargin(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] font-mono text-text-muted">{t("pricingAssumptionNote")}</p>
        </div>
      </GlassPanel>

      {hasAny && (
        <GlassPanel glow="cyan" className="p-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("pricingResults")}</h3>
            <SpatialBadge variant="cyan">{t("yourEstimate")}</SpatialBadge>
          </div>
          <div className="space-y-2 text-sm">
            <Row label={t("floorPrice")} value={formatCurrency(totalUnitCost)} hint={t("floorPriceHint")} />
            <Row label={t("suggestedPrice")} value={formatCurrency(Math.round(suggestedPrice))} tone="positive" />
            <Row label={t("profitPerUnit")} value={formatCurrency(profitPerUnit)} />
            {units > 0 && <Row label={t("monthlyProfitAtScale")} value={formatCurrency(monthlyProfit)} tone={monthlyProfit >= 0 ? "positive" : "negative"} />}
            {units > 0 && overhead > 0 && (
              <p className="text-xs text-text-muted">{t("overheadShareNote", { amount: formatCurrency(overheadPerUnit) })}</p>
            )}
            <p className="pt-2 text-[10px] font-mono uppercase tracking-wider text-text-muted/60">{t("estimateDisclaimer")}</p>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

function ExpandSection({ netCashFlow, loading }: { netCashFlow: number | null; loading: boolean }) {
  const t = useTranslations("advisory");
  const emi = useCalculateEMI();
  const [cost, setCost] = useState("");
  const [extraIncome, setExtraIncome] = useState("");
  const [rate, setRate] = useState("12");
  const [tenure, setTenure] = useState("24");
  const [result, setResult] = useState<{ emi: number; monthsToSave: number | null } | null>(null);

  const purchaseCost = Number(cost) || 0;
  const extra = Number(extraIncome) || 0;

  const evaluate = async () => {
    const tenureMonths = Number(tenure) || 0;
    if (purchaseCost <= 0 || tenureMonths <= 0) return;
    try {
      const res = await emi.mutateAsync({
        principal: purchaseCost,
        annual_interest_rate: Number(rate),
        tenure_months: tenureMonths,
      });
      setResult({
        emi: toNumber(res.monthly_emi),
        monthsToSave:
          netCashFlow != null && netCashFlow > 0 ? Math.ceil(purchaseCost / netCashFlow) : null,
      });
    } catch {
      setResult(null);
    }
  };

  const surplusKnown = netCashFlow != null;
  const surplus = netCashFlow ?? 0;
  const affordableBySurplus = result != null && result.emi <= surplus * 0.5;

  return (
    <div className="space-y-4">
      <GlassPanel hudCorners className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-4 flex items-center gap-2">
          <Package className="h-4 w-4 text-cyan-400" />
          <span>{t("expandInputs")}</span>
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-text-secondary">{t("purchaseCost")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={t("phAmount")} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("expectedExtraIncome")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" value={extraIncome} onChange={(e) => setExtraIncome(e.target.value)} placeholder={t("phExpected")} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("interestRate")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="0" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-text-secondary">{t("tenureMonths")}</Label>
              <Input className="mt-1 bg-surface-container border-cyan-500/20" type="number" min="1" value={tenure} onChange={(e) => setTenure(e.target.value)} />
            </div>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface-container/80 px-3.5 py-2.5 text-xs text-text-muted">
            {loading || surplusKnown == null
              ? t("checkingCashflow")
              : surplus > 0
                ? t("currentSurplusPositive", { amount: formatCurrency(surplus) })
                : t("currentSurplusNegative", { amount: formatCurrency(Math.abs(surplus)) })}
          </div>
          <Button
            type="button"
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
            onClick={() => void evaluate()}
            disabled={emi.isPending || purchaseCost <= 0}
          >
            {emi.isPending ? t("calculating") : t("evaluateAffordability")}
          </Button>
        </div>
      </GlassPanel>

      {result && (
        <GlassPanel glow="cyan" className="p-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">{t("affordabilityResults")}</h3>
            <SpatialBadge variant="cyan">{t("basedOnYourData")}</SpatialBadge>
          </div>
          <div className="space-y-2 text-sm">
            <Row label={t("estimatedEmi")} value={formatCurrency(result.emi)} />
            {extra > 0 && <Row label={t("netImpactWithExtraIncome")} value={formatCurrency(extra - result.emi)} tone={extra - result.emi >= 0 ? "positive" : "negative"} />}
            {!affordableBySurplus && surplusKnown && surplus >= 0 && (
              <Warning text={t("warningEmiTooHigh", { emi: formatCurrency(result.emi), surplus: formatCurrency(surplus) })} />
            )}
            {surplusKnown && surplus < 0 && (
              <Warning text={t("warningNegativeCashflow")} />
            )}
            {result.monthsToSave != null && (
              <p className="text-xs text-text-muted">{t("saveInsteadOption", { count: result.monthsToSave })}</p>
            )}
            {surplusKnown && extra > 0 && extra - result.emi > 0 && (
              <p className="text-xs text-text-muted">{t("positiveIfRealized", { amount: formatCurrency(extra - result.emi) })}</p>
            )}
            <p className="pt-2 text-[10px] font-mono uppercase tracking-wider text-text-muted/60">{t("estimateDisclaimer")}</p>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

function Row({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "positive" | "negative" }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2.5 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-text-secondary text-xs">{label}</p>
        {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
      </div>
      <span
        className={cn(
          "shrink-0 font-mono font-bold tabular-nums text-sm",
          tone === "positive" ? "text-cyan-300" : tone === "negative" ? "text-rose-400" : "text-text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <p className="text-xs text-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}
