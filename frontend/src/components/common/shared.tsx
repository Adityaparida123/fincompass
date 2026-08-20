"use client";

import { type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  loading,
  trend,
  trendValue,
  className,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  loading?: boolean;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  className?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <Card className={cn("stat-card relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-1.5">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{label}</CardTitle>
        {Icon && (
          <div className="stat-card-icon rounded-md bg-primary/10 p-1.5 text-primary transition-colors group-hover:bg-primary/20">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ) : (
          <div>
            <p className="text-2xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">{value}</p>
            {(subtitle || trendValue) && (
              <div className="mt-1.5 flex items-center gap-2">
                {trend && trendValue && (
                  <span className={cn("flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5", trend === "down" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                    <TrendIcon className="h-3 w-3" />
                    {trendValue}
                  </span>
                )}
                {subtitle && (
                  <span className="text-[11px] text-text-muted">{subtitle}</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state-animate flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-8 py-12 text-center">
      {Icon && (
        <div className="empty-icon mb-3 rounded-full bg-surface-container-high p-3">
          <Icon className="h-6 w-6 text-text-muted" />
        </div>
      )}
      <h3 className="empty-text text-sm font-medium text-text-primary">{title}</h3>
      {description && <p className="empty-text mt-2 max-w-xs text-xs text-text-muted leading-relaxed">{description}</p>}
      {action && <div className="empty-action mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="mt-1 md:mt-0">{action}</div>}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
