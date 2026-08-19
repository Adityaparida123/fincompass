"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton, Badge } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/common/shared";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";
import { Bell, Check, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkRead = async (id: number) => {
    try { await markRead.mutateAsync(id); } catch (err) {
      console.error(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  const handleMarkAllRead = async () => {
    try { await markAllRead.mutateAsync(); } catch (err) {
      console.error(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={data ? `${data.items.length} notifications · ${data.unread} unread` : undefined}
        action={
          data && data.unread > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              {t("markAllRead")}
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : data?.items?.length ? (
        <div className="space-y-2">
          {data.items.map((n) => (
            <Card key={n.id} className={`transition-colors ${!n.is_read ? "border-primary/20 bg-primary/5" : ""}`}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className={`rounded-lg p-1.5 ${!n.is_read ? "bg-primary/10" : "bg-surface-container"}`}>
                  <Bell className={`h-4 w-4 ${!n.is_read ? "text-primary" : "text-text-muted"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-[11px] text-text-muted">{format(new Date(n.created_at), "PPp")}</p>
                    </div>
                    {!n.is_read && (
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => handleMarkRead(n.id)} disabled={markRead.isPending}>
                        <Check className="mr-1 h-3 w-3" />{t("markRead")}
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-muted leading-relaxed">{n.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("noNotifications")}
          description="You're all caught up. Notifications about your finances will appear here."
          icon={Bell}
        />
      )}
    </div>
  );
}
