"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Terminal } from "lucide-react";
import { SpatialBadge } from "./spatial-badge";

interface CommandHeaderProps {
  title: string;
  subtitle?: string;
  tag?: string;
  badge?: ReactNode;
  action?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export function CommandHeader({
  title,
  subtitle,
  tag,
  badge,
  action,
  className,
}: CommandHeaderProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-surface-card/90 via-surface-card/60 to-cyan-950/20 p-5 md:p-6 backdrop-blur-xl mb-6 overflow-hidden hud-corner",
        className
      )}
    >
      {/* Background cyber grid & ambient aura */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            {tag && (
              <SpatialBadge variant="cyan" pulse icon={<Terminal className="h-3 w-3" />}>
                {tag}
              </SpatialBadge>
            )}
            {badge}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <span>{title}</span>
          </h1>
          {subtitle && (
            <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">{subtitle}</p>
          )}
        </div>

        {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
      </div>
    </div>
  );
}
