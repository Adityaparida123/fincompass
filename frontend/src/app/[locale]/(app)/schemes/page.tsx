"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/common/shared";
import { useSchemes } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { Landmark, ExternalLink, AlertTriangle } from "lucide-react";

export default function SchemesPage() {
  const t = useTranslations("schemes");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useSchemes();

  const activeSchemes = data?.filter((s) => s.active) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={`${activeSchemes.length} active schemes available`} />

      <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-text-muted leading-relaxed">
            {t("eligibilityDisclaimer")}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : activeSchemes.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeSchemes.map((s) => (
            <Card key={s.id} className="transition-colors hover:bg-surface-container">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium leading-snug">{s.name}</CardTitle>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{s.jurisdiction}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="text-text-muted leading-relaxed">{s.description}</p>
                <div className="rounded-lg bg-surface-container/30 px-3 py-2">
                  <p className="font-medium text-[11px] uppercase tracking-wider text-text-muted">{t("eligibility")}</p>
                  <p className="mt-0.5 text-text-muted">{s.eligibility}</p>
                </div>
                <div className="rounded-lg bg-surface-container/30 px-3 py-2">
                  <p className="font-medium text-[11px] uppercase tracking-wider text-text-muted">{t("benefits")}</p>
                  <p className="mt-0.5 text-text-muted">{s.benefits}</p>
                </div>
                {s.source_url && (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />{t("learnMore")}
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("noSchemes")}
          description="Government schemes will appear here based on your eligibility."
          icon={Landmark}
        />
      )}
    </div>
  );
}
