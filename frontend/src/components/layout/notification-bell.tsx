"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Bell } from "lucide-react";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const locale = useLocale();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const unread = data?.unread ?? 0;
  const items = data?.items?.slice(0, 5) ?? [];

  return (
    <div className="relative group">
      <Link href={`/${locale}/notifications`}>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </Link>
      <div className="invisible absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-card p-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
        {items.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No notifications</p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              className={cn(
                "w-full rounded-lg p-3 text-left text-sm hover:bg-muted",
                !n.is_read && "bg-primary/5",
              )}
              onClick={() => !n.is_read && markRead.mutate(n.id)}
            >
              <p className="font-medium">{n.title}</p>
              <p className="text-muted-foreground line-clamp-2">{n.message}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
