"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  glow?: "cyan" | "indigo" | "emerald" | "rose" | "amber" | "none";
  hudCorners?: boolean;
  hologramEdge?: boolean;
  elevated?: boolean;
  onClick?: () => void;
}

export function GlassPanel({
  children,
  className,
  glow = "none",
  hudCorners = false,
  hologramEdge = false,
  elevated = false,
  onClick,
}: GlassPanelProps) {
  const glowClasses = {
    cyan: "hover:shadow-[0_0_25px_rgba(0,242,254,0.18)] hover:border-cyan-400/40",
    indigo: "hover:shadow-[0_0_25px_rgba(129,140,248,0.18)] hover:border-indigo-400/40",
    emerald: "hover:shadow-[0_0_25px_rgba(52,211,153,0.18)] hover:border-emerald-400/40",
    rose: "hover:shadow-[0_0_25px_rgba(244,63,94,0.18)] hover:border-rose-400/40",
    amber: "hover:shadow-[0_0_25px_rgba(245,158,11,0.18)] hover:border-amber-400/40",
    none: "",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        elevated ? "glass-panel-elevated" : "glass-panel",
        hudCorners && "hud-corner",
        hologramEdge && "hologram-edge",
        glowClasses[glow],
        onClick && "cursor-pointer transition-transform duration-200 hover:-translate-y-0.5",
        "relative overflow-hidden p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function GlassPanelHeader({
  title,
  subtitle,
  badge,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between pb-3 gap-2", className)}>
      <div className="min-w-0">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/70 inline-block" />
          {title}
        </h3>
        {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {action}
      </div>
    </div>
  );
}
