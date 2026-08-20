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
  const hasMarkedAllRef = useRef(false);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  useEffect(() => {
    if (open && unread > 0 && !hasMarkedAllRef.current) {
      hasMarkedAllRef.current = true;
      markAllRead.mutate(undefined, {
        onSettled: () => {
          hasMarkedAllRef.current = false;
        },
      });
    }
    if (!open) {
      hasMarkedAllRef.current = false;
    }
  }, [open, unread, markAllRead]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative hover:text-primary transition-colors text-on-surface-variant p-1.5 rounded-lg hover:bg-surface-container-high"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-error rounded-full ring-2 ring-background-page" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-surface-card p-1.5 shadow-floating animate-scale-in">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  className="text-[11px] text-text-muted hover:text-foreground transition-colors"
                  onClick={() => { markAllRead.mutate(); setOpen(false); }}
                >
                  Mark all read
                </button>
              )}
              <Link
                href={`/${locale}/notifications`}
                className="text-[11px] text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                View all
              </Link>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-text-muted text-center">No notifications</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "w-full rounded-lg p-2.5 text-left text-sm hover:bg-surface-container-high transition-colors",
                  !n.is_read && "bg-primary/5",
                )}
                onClick={() => {
                  if (!n.is_read) markRead.mutate(n.id);
                  setOpen(false);
                }}
              >
                <p className="font-medium text-text-primary">{n.title}</p>
                <p className="text-text-muted line-clamp-2 text-xs mt-0.5">{n.message}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
