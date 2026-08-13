"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton, Badge } from "@/components/ui/input";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();

  const handleMarkRead = async (id: number) => {
    try { await markRead.mutateAsync(id); } catch (err) {
      console.error(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        {data && <Badge variant="secondary">{data.unread} {t("unread")}</Badge>}
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : data?.items?.length ? (
        <div className="space-y-3">
          {data.items.map((n) => (
            <Card key={n.id} className={!n.is_read ? "border-primary/30" : ""}>
              <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">{n.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{format(new Date(n.created_at), "PPp")}</p>
                </div>
                {!n.is_read && (
                  <Button size="sm" variant="outline" onClick={() => handleMarkRead(n.id)} disabled={markRead.isPending}>
                    {t("markRead")}
                  </Button>
                )}
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{n.message}</p></CardContent>
            </Card>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">{t("noNotifications")}</p>}
    </div>
  );
}
