"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/common/shared";
import { useRecycleBin, useRestoreRecycleItem } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";
import { Trash2 } from "lucide-react";

export default function RecycleBinPage() {
  const t = useTranslations("recycleBin");
  const tc = useTranslations("common");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading, isError, refetch } = useRecycleBin();
  const restore = useRestoreRecycleItem();

  const handleRestore = async (id: number) => {
    setError("");
    try {
      await restore.mutateAsync(id);
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={`${data?.length ?? 0} items`} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : data?.length ? (
        <div className="space-y-2">
          {data.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize">{item.resource_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{t("deletedAt")}: {format(new Date(item.deleted_at), "PPp")}</p>
                </div>
                {confirmId === item.id ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRestore(item.id)} disabled={restore.isPending}>{tc("confirm")}</Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>{tc("cancel")}</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirmId(item.id)}>{t("restore")}</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={t("noItems")} description="Deleted items will appear here and can be restored within a limited time." icon={Trash2} />
      )}
    </div>
  );
}
