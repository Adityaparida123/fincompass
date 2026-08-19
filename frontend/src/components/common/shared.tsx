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
  const trendColor = trend === "up" ? "text-income" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className={cn("relative overflow-hidden group", className)}>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none" />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[12px] font-semibold uppercase tracking-[0.05em] text-text-muted">{label}</CardTitle>
        {Icon && (
          <div className="rounded-full bg-surface-container p-2 text-primary group-hover:bg-primary/20 transition-colors">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : (
          <div>
            <p className="text-2xl font-bold tracking-tight font-[family-name:var(--font-jetbrains-mono)] tabular-nums">{value}</p>
            {(subtitle || trendValue) && (
              <div className="mt-2 flex items-center gap-2">
                {trend && trendValue && (
                  <span className={cn("flex items-center gap-1 text-xs font-semibold bg-primary/20 text-primary rounded-full px-2 py-0.5", trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    {trendValue}
                  </span>
                )}
                {subtitle && (
                  <span className="text-xs text-text-muted">{subtitle}</span>
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
    <div className="glass-panel flex flex-col items-center justify-center rounded-xl px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 rounded-full bg-surface-container p-3">
          <Icon className="h-6 w-6 text-text-muted" />
        </div>
      )}
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
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
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-[32px] leading-[40px] font-semibold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="text-[16px] leading-[24px] text-text-muted mt-1">{subtitle}</p>}
      </div>
      {action && <div className="mt-2 md:mt-0">{action}</div>}
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
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-text-muted">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
