"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { useSchemes } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";

export default function SchemesPage() {
  const t = useTranslations("schemes");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useSchemes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {t("eligibilityDisclaimer")}
        </p>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.filter((s) => s.active).map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <Badge variant="outline">{s.jurisdiction}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{s.description}</p>
                <div><p className="font-medium">{t("eligibility")}</p><p className="text-muted-foreground">{s.eligibility}</p></div>
                <div><p className="font-medium">{t("benefits")}</p><p className="text-muted-foreground">{s.benefits}</p></div>
                {s.source_url && (
                  <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-block text-primary hover:underline">{t("learnMore")}</a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">{t("noSchemes")}</p>}
    </div>
  );
}
