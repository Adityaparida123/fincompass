"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton, Badge } from "@/components/ui/input";
import { PageHeader } from "@/components/common/shared";
import { useConsents, useGrantConsent, useRevokeConsent } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";
import { Lock, Unlock } from "lucide-react";

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
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("revokeWarning")} />

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {Object.keys(CONSENT_LABELS).map((consentType) => {
            const item = data?.items?.find((c) => c.consent_type === consentType);
            const granted = item?.status === "granted";
            const labelKey = CONSENT_LABELS[consentType];
            return (
              <Card key={consentType}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className={`rounded-lg p-2 ${granted ? "bg-income/10" : "bg-surface-container"}`}>
                    {granted ? <Unlock className="h-4 w-4 text-income" /> : <Lock className="h-4 w-4 text-text-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{t(labelKey as "financialAnalysis")}</p>
                      <Badge variant={granted ? "success" : "secondary"} className="text-[10px]">
                        {item ? item.status : t("notGranted")}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{CONSENT_DESCRIPTIONS[consentType]}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={granted ? "outline" : "default"}
                    onClick={() => handleToggle(consentType, granted)}
                    disabled={grant.isPending || revoke.isPending}
                  >
                    {granted ? t("revoke") : t("grant")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
