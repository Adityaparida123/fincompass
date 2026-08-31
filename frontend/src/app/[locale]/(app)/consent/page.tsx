"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/input";
import { useConsents, useGrantConsent, useRevokeConsent } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";
import { Lock, Unlock, ShieldCheck, ShieldAlert } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

const CONSENT_LABELS: Record<string, string> = {
  financial_data_analysis: "financialAnalysis",
  personalized_recommendations: "recommendations",
  chat_financial_context: "chatContext",
};

const CONSENT_DESCRIPTIONS: Record<string, string> = {
  financial_data_analysis: "Enables expense tracking, cash flow analysis, budget monitoring, and ML-powered forecasts.",
  personalized_recommendations: "Enables personalized financial recommendations based on your data.",
  chat_financial_context: "Allows FinAI to access your financial data when answering questions.",
};

export default function ConsentPage() {
  const t = useTranslations("consent");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useConsents();
  const grant = useGrantConsent();
  const revoke = useRevokeConsent();

  const handleToggle = async (type: string, granted: boolean) => {
    try {
      if (granted) await revoke.mutateAsync(type);
      else await grant.mutateAsync(type);
    } catch (err) {
      console.error(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="DATA GOVERNANCE & CONSENT"
        title={t("title")}
        subtitle={t("revokeWarning")}
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant="emerald" pulse>DPDP 2023 COMPLIANT</SpatialBadge>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {Object.keys(CONSENT_LABELS).map((consentType) => {
            const item = data?.items?.find((c) => c.consent_type === consentType);
            const granted = item?.status === "granted";
            const labelKey = CONSENT_LABELS[consentType];
            return (
              <GlassPanel key={consentType} glow={granted ? "emerald" : "none"} hudCorners className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`rounded-xl p-2.5 shrink-0 ${granted ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-surface-container text-text-muted border border-white/5"}`}>
                      {granted ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-text-primary">{t(labelKey as "financialAnalysis")}</h4>
                        <SpatialBadge variant={granted ? "emerald" : "neutral"}>
                          {item ? item.status.toUpperCase() : t("notGranted").toUpperCase()}
                        </SpatialBadge>
                      </div>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">{CONSENT_DESCRIPTIONS[consentType]}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={`shrink-0 font-bold px-4 ${granted ? "border-white/10 text-text-secondary hover:bg-surface-container" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]"}`}
                    variant={granted ? "outline" : "default"}
                    onClick={() => handleToggle(consentType, granted)}
                    disabled={grant.isPending || revoke.isPending}
                  >
                    {granted ? t("revoke") : t("grant")}
                  </Button>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
