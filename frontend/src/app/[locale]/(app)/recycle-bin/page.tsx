"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/input";
import { useRecycleBin, useRestoreRecycleItem } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";

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
      <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : data?.length ? (
        <div className="space-y-3">
          {data.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2">
                <div>
                  <CardTitle className="text-base capitalize">{item.resource_type}</CardTitle>
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
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(item.deleted_data, null, 2)}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
    </div>
  );
}
