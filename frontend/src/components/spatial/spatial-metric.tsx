"use client";

import React, { type ReactNode, isValidElement, type ReactElement } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/input";

interface SpatialMetricProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  glow?: "cyan" | "indigo" | "emerald" | "rose" | "amber" | "none";
  badge?: ReactNode;
  className?: string;
}

export function SpatialMetric({
  label,
  value,
  subtitle,
  icon,
  loading = false,
  trend,
  trendValue,
  glow = "cyan",
  badge,
  className,
}: SpatialMetricProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const glowStyles: Record<string, string> = {
    cyan: "border-cyan-500/20 hover:border-cyan-400/40 hover:shadow-[0_0_20px_rgba(0,242,254,0.12)]",
    indigo: "border-indigo-500/20 hover:border-indigo-400/40 hover:shadow-[0_0_20px_rgba(129,140,248,0.12)]",
    emerald: "border-emerald-500/20 hover:border-emerald-400/40 hover:shadow-[0_0_20px_rgba(52,211,153,0.12)]",
    rose: "border-rose-500/20 hover:border-rose-400/40 hover:shadow-[0_0_20px_rgba(244,63,94,0.12)]",
    amber: "border-amber-500/20 hover:border-amber-400/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.12)]",
    none: "border-border/60",
  };

  const renderIcon = (iconNode: React.ReactNode) => {
    if (isValidElement(iconNode)) {
      return React.cloneElement(iconNode as ReactElement<{ className?: string }>, { className: "h-4 w-4" });
    }
    return iconNode;
  };

  return (
    <div
      className={cn(
        "glass-panel relative overflow-hidden p-4 md:p-5 transition-all duration-200 group",
        glowStyles[glow],
        className
      )}
    >
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80 inline-block" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted truncate">
            {label}
          </span>
        </div>
        {badge ? (
          badge
        ) : icon ? (
          <div className="rounded-lg bg-primary/10 p-1.5 text-primary transition-all duration-200 group-hover:bg-primary/20 group-hover:scale-110">
            {renderIcon(icon)}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-2 mt-1">
          <Skeleton className="h-7 w-28 bg-surface-container-high" />
          <Skeleton className="h-3.5 w-16 bg-surface-container-high" />
        </div>
      ) : (
        <div className="mt-1">
          <p className="text-2xl lg:text-3xl font-bold tracking-tight tabular-metric text-text-primary group-hover:text-cyan-300 transition-colors duration-200">
            {value}
          </p>
          {(subtitle || trendValue) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {trend && trendValue && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 border",
                    trend === "down"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {trendValue}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-text-muted truncate">{subtitle}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
