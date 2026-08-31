"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/input";
import { EmptyState } from "@/components/common/shared";
import { useSchemes, useBusinessProfile, useRecommendedSchemes } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { Landmark, ExternalLink, AlertTriangle, Sparkles, Globe, ShieldCheck } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

const SCHEME_CATEGORIES = ["banking", "agriculture", "pension", "business", "savings", "housing"] as const;
type SchemeCategory = (typeof SCHEME_CATEGORIES)[number];

function categoryKey(category: string | null | undefined): SchemeCategory | null {
  return SCHEME_CATEGORIES.includes(category as SchemeCategory) ? (category as SchemeCategory) : null;
}

export default function SchemesPage() {
  const t = useTranslations("schemes");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useSchemes();
  const profile = useBusinessProfile();

  const hasBusinessContext = !!profile.data && (!!profile.data.state || !!profile.data.business_type);
  const recommended = useRecommendedSchemes(hasBusinessContext);

  const activeSchemes = data?.filter((s) => s.active) ?? [];
  const recommendedSchemes = recommended.data ?? [];

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="GOVERNMENT & INSTITUTIONAL SCHEMES"
        title={t("title")}
        subtitle={t("activeCount", { count: activeSchemes.length })}
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant="cyan" pulse>GEO-TARGETED</SpatialBadge>
          </div>
        }
      />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200 flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p>{t("eligibilityDisclaimer")}</p>
      </div>

      {/* AI Recommended Subsidies & Schemes */}
      {hasBusinessContext && (
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">{t("recommendedTitle")}</h3>
            </div>
            <SpatialBadge variant="cyan">ENTERPRISE MATCHED</SpatialBadge>
          </div>
          {recommended.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
            </div>
          ) : recommended.isError ? (
            <PageError message={tc("error")} onRetry={() => recommended.refetch()} />
          ) : recommendedSchemes.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {recommendedSchemes.map(({ scheme, match_reason }) => (
                <GlassPanel key={scheme.id} glow="cyan" hudCorners className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/5">
                    <h4 className="text-sm font-bold text-text-primary leading-snug">{scheme.name}</h4>
                    <SpatialBadge variant="cyan">{scheme.jurisdiction}</SpatialBadge>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{scheme.description}</p>
                  {categoryKey(scheme.category) && (
                    <p className="text-[11px] text-text-muted font-mono">
                      <span className="font-semibold uppercase text-cyan-300">{t("targetUsers")}: </span>
                      {t(`categoryTarget.${categoryKey(scheme.category)}`)}
                    </p>
                  )}
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-cyan-400 font-mono">{t("whyThis")}</p>
                    <p className="mt-0.5 text-xs text-cyan-200 font-mono">{match_reason}</p>
                  </div>
                  {scheme.source_url && (
                    <a
                      href={scheme.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />{t("learnMore")}
                    </a>
                  )}
                </GlassPanel>
              ))}
            </div>
          ) : (
            <p className="text-xs font-mono text-text-muted">{t("noRecommended")}</p>
          )}
        </section>
      )}

      {!hasBusinessContext && !profile.isLoading && (
        <p className="text-xs font-mono text-text-muted">
          {t("addBusinessHint")}
        </p>
      )}

      {/* Global & State Directory */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Official Directory</h3>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
          </div>
        ) : isError ? (
          <PageError message={tc("error")} onRetry={() => refetch()} />
        ) : activeSchemes.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeSchemes.map((s) => (
              <GlassPanel key={s.id} glow="none" hudCorners className="p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/5">
                    <h4 className="text-sm font-semibold text-text-primary leading-snug">{s.name}</h4>
                    <SpatialBadge variant="neutral">{s.jurisdiction}</SpatialBadge>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{s.description}</p>
                  {categoryKey(s.category) && (
                    <p className="text-[11px] text-text-secondary font-mono">
                      <span className="font-semibold uppercase text-text-muted">{t("targetUsers")}: </span>
                      {t(`categoryTarget.${categoryKey(s.category)}`)}
                    </p>
                  )}
                  <div className="rounded-xl border border-white/5 bg-surface-container/60 p-3 space-y-1">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-text-muted font-mono">{t("eligibility")}</p>
                    <p className="text-xs text-text-secondary">{s.eligibility}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-surface-container/60 p-3 space-y-1">
                    <p className="font-bold text-[10px] uppercase tracking-wider text-text-muted font-mono">{t("benefits")}</p>
                    <p className="text-xs text-text-secondary">{s.benefits}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  {s.source_url && (
                    <a
                      href={s.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />{t("learnMore")}
                    </a>
                  )}
                  {s.last_verified && (
                    <span className="text-[10px] font-mono text-text-muted">{t("verifiedOn", { date: format(new Date(s.last_verified), "MMM yyyy") })}</span>
                  )}
                </div>
              </GlassPanel>
            ))}
          </div>
        ) : (
          <EmptyState
            title={t("noSchemes")}
            description={t("noSchemesDesc")}
            icon={Landmark}
          />
        )}
      </div>
    </div>
  );
}
