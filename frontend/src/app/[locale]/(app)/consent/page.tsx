"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton, Badge } from "@/components/ui/input";
import { useConsents, useGrantConsent, useRevokeConsent } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";

const CONSENT_LABELS: Record<string, string> = {
  financial_data_analysis: "financialAnalysis",
  personalized_recommendations: "recommendations",
  chat_financial_context: "chatContext",
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
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("revokeWarning")}</p>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {Object.keys(CONSENT_LABELS).map((consentType) => {
            const item = data?.items?.find((c) => c.consent_type === consentType);
            const granted = item?.status === "granted";
            const labelKey = CONSENT_LABELS[consentType];
            return (
              <Card key={consentType}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">{t(labelKey as "financialAnalysis")}</CardTitle>
                    <Badge variant={granted ? "success" : "secondary"} className="mt-1">{item ? item.status : t("notGranted")}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={granted ? "outline" : "default"}
                    onClick={() => handleToggle(consentType, granted)}
                    disabled={grant.isPending || revoke.isPending}
                  >
                    {granted ? t("revoke") : t("grant")}
                  </Button>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
