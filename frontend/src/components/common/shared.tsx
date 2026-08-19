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
    <Card className={cn("relative overflow-hidden group", className)}>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none" />
      <CardHeader className="flex flex-row items-center justify-between pb-1.5">
        <CardTitle className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</CardTitle>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-1.5 text-primary group-hover:bg-primary/20 transition-colors">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ) : (
          <div>
            <p className="text-xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">{value}</p>
            {(subtitle || trendValue) && (
              <div className="mt-1.5 flex items-center gap-2">
                {trend && trendValue && (
                  <span className={cn("flex items-center gap-1 text-[11px] font-semibold bg-primary/15 text-primary rounded-full px-2 py-0.5", trend === "down" && "bg-destructive/15 text-destructive")}>
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
    <div className="glass-panel flex flex-col items-center justify-center rounded-xl px-6 py-10 text-center">
      {Icon && (
        <div className="mb-2.5 rounded-full bg-surface-container-high/60 p-2.5">
          <Icon className="h-5 w-5 text-text-muted" />
        </div>
      )}
      <h3 className="text-[13px] font-medium text-text-primary">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-[12px] text-text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
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
        <h1 className="text-[28px] leading-[36px] font-semibold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="text-[14px] leading-[20px] text-text-muted mt-0.5">{subtitle}</p>}
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
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{title}</h2>
        {subtitle && <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
