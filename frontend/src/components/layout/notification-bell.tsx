"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Bell } from "lucide-react";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const locale = useLocale();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unread = data?.unread ?? 0;
  const items = data?.items?.slice(0, 5) ?? [];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-card p-2 shadow-lg">
          <div className="flex items-center justify-between px-3 py-1">
            <p className="text-xs font-medium text-muted-foreground">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { markAllRead.mutate(); setOpen(false); }}
                >
                  Mark all read
                </button>
              )}
              <Link
                href={`/${locale}/notifications`}
                className="text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                View all
              </Link>
            </div>
          </div>
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
                onClick={() => {
                  if (!n.is_read) markRead.mutate(n.id);
                  setOpen(false);
                }}
              >
                <p className="font-medium">{n.title}</p>
                <p className="text-muted-foreground line-clamp-2">{n.message}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
