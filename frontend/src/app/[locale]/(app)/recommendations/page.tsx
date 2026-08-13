"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { useRecommendations } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";

export default function RecommendationsPage() {
  const t = useTranslations("recommendations");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useRecommendations();

  const sorted = [...(data?.recommendations ?? [])].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : sorted.length ? (
        <div className="space-y-3">
          {sorted.map((r, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-base">{r.title}</CardTitle>
                <Badge variant="secondary">P{r.priority}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{r.reason}</p>
                <Badge variant="outline" className="mt-2">{r.type.replace(/_/g, " ")}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">{t("noRecommendations")}</p>}
    </div>
  );
}
