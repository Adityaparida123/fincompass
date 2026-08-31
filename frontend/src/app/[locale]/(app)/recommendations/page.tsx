"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/input";
import { EmptyState } from "@/components/common/shared";
import { useRecommendations } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { useChatStore } from "@/stores/chat-store";
import { MessageCircle, Lightbulb, TrendingUp, Wallet, Receipt, CreditCard, ShieldCheck, PiggyBank, Landmark, HandCoins, AlertTriangle, BarChart3, Sparkles } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

const TYPE_ICONS: Record<string, typeof Lightbulb> = {
  income: TrendingUp,
  budgeting: Wallet,
  expense_reduction: Receipt,
  debt: CreditCard,
  emergency_fund: ShieldCheck,
  savings: PiggyBank,
  schemes: Landmark,
  non_credit_alternatives: HandCoins,
  responsible_borrowing: AlertTriangle,
  forecast_alert: BarChart3,
  category_forecast: BarChart3,
};

export default function RecommendationsPage() {
  const t = useTranslations("recommendations");
  const th = useTranslations("home");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useRecommendations();
  const { setOpen, setDraft } = useChatStore();

  const askFinai = (title: string) => {
    setDraft(th("recommendationDraft", { title }));
    setOpen(true);
  };

  const sorted = [...(data?.recommendations ?? [])].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="INTELLIGENCE DIRECTIVES"
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant="cyan" pulse>{sorted.length} ACTIVE DIRECTIVES</SpatialBadge>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : sorted.length ? (
        <div className="space-y-3">
          {sorted.map((r, i) => {
            const Icon = TYPE_ICONS[r.type] ?? Lightbulb;
            const glow = r.priority === 1 ? "rose" : r.priority === 2 ? "amber" : "cyan";
            const badgeVariant = r.priority === 1 ? "rose" : r.priority === 2 ? "amber" : "cyan";

            return (
              <GlassPanel key={i} glow={glow} hudCorners className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2.5 shrink-0 text-cyan-400 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <SpatialBadge variant={badgeVariant}>P{r.priority}</SpatialBadge>
                        <h4 className="text-sm font-semibold text-text-primary leading-snug">{r.title}</h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed pt-1">{r.reason}</p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0">
                    <SpatialBadge variant="neutral">{r.type.replace(/_/g, " ")}</SpatialBadge>
                    <button
                      type="button"
                      onClick={() => askFinai(r.title)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-mono font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(0,242,254,0.2)]"
                    >
                      <Sparkles className="h-3 w-3 text-cyan-400" />
                      <span>{th("askInsight")}</span>
                    </button>
                  </div>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t("noRecommendations")}
          description={t("noRecommendationsDesc")}
          icon={Lightbulb}
        />
      )}
    </div>
  );
}
