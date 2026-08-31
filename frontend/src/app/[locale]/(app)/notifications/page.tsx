"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/input";
import { EmptyState } from "@/components/common/shared";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";
import { Bell, Check, CheckCheck, Radio } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

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
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="SIGNAL DISPATCH"
        title={t("title")}
        subtitle={data ? `${data.items.length} telemetry signals · ${data.unread} pending review` : undefined}
        action={
          data && data.unread > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
              className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 font-bold"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              {t("markAllRead")}
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : data?.items?.length ? (
        <div className="space-y-3">
          {data.items.map((n) => (
            <GlassPanel key={n.id} glow={!n.is_read ? "cyan" : "none"} hudCorners className="p-4">
              <div className="flex items-start gap-3.5">
                <div className={`rounded-xl p-2.5 shrink-0 ${!n.is_read ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-surface-container text-text-muted border border-white/5"}`}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {!n.is_read && <SpatialBadge variant="cyan" pulse>NEW</SpatialBadge>}
                        <h4 className="text-sm font-semibold text-text-primary">{n.title}</h4>
                      </div>
                      <p className="text-[10px] font-mono text-text-muted mt-0.5">{format(new Date(n.created_at), "PPp")}</p>
                    </div>
                    {!n.is_read && (
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2.5 text-xs font-mono text-cyan-300 hover:bg-cyan-500/10" onClick={() => handleMarkRead(n.id)} disabled={markRead.isPending}>
                        <Check className="mr-1 h-3 w-3" />{t("markRead")}
                      </Button>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">{n.message}</p>
                </div>
              </div>
            </GlassPanel>
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("noNotifications")}
          description="You're all caught up. System alerts and AI notifications will appear here."
          icon={Bell}
        />
      )}
    </div>
  );
}
