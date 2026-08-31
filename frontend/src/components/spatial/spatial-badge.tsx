"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SpatialBadgeProps {
  children: ReactNode;
  variant?: "cyan" | "emerald" | "amber" | "rose" | "indigo" | "muted" | "neutral";
  pulse?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function SpatialBadge({
  children,
  variant = "cyan",
  pulse = false,
  className,
  icon,
}: SpatialBadgeProps) {
  const variantStyles = {
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(0,242,254,0.15)]",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]",
    indigo: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(129,140,248,0.15)]",
    muted: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    neutral: "bg-white/5 text-text-muted border-white/10",
  };

  const dotColors = {
    cyan: "bg-cyan-400",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    indigo: "bg-indigo-400",
    muted: "bg-slate-400",
    neutral: "bg-slate-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border uppercase tracking-wider backdrop-blur-md",
        variantStyles[variant],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              dotColors[variant]
            )}
          />
          <span className={cn("relative inline-flex rounded-full h-2 w-2", dotColors[variant])} />
        </span>
      )}
      {icon}
      <span>{children}</span>
    </span>
  );
}
