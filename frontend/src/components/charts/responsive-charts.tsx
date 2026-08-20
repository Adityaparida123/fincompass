"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line, Area, AreaChart, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#2dd4bf", "#818cf8", "#f59e0b", "#f87171", "#a78bfa", "#22d3ee", "#34d399", "#fb923c"];

function ChartTooltipContent({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-card px-3 py-2 shadow-lg">
      {label && <p className="mb-1 text-[11px] font-medium text-text-muted">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-[13px]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-text-muted">{entry.name}:</span>
          <span className="font-medium text-text-primary">{formatter ? formatter(entry.value, entry.name) : entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltipContent({ active, payload, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-border bg-surface-card px-3 py-2 shadow-lg">
      <p className="text-[13px] font-medium text-text-primary">{entry.name}</p>
      <p className="text-[13px] text-text-muted">{formatter ? formatter(entry.value) : entry.value.toLocaleString()}</p>
    </div>
  );
}

export function ResponsiveBarChart({
  data,
  xKey,
  bars,
  valueFormatter,
  className,
  showGrid = true,
  height,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; color?: string; name?: string }[];
  valueFormatter?: (value: number, name: string) => string;
  className?: string;
  showGrid?: boolean;
  height?: string;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  return (
    <div className={cn("w-full min-w-0", height ?? "h-52 sm:h-60 lg:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />}
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip content={<ChartTooltipContent formatter={fmt} />} cursor={{ fill: "var(--surface-container-high)", opacity: 0.3 }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} fill={b.color ?? COLORS[i % COLORS.length]} name={b.name ?? b.key} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResponsiveLineChart({
  data,
  xKey,
  lines,
  valueFormatter,
  className,
  showGrid = true,
  showArea = false,
  height,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  lines: { key: string; color?: string; name?: string; dashed?: boolean }[];
  valueFormatter?: (value: number, name: string) => string;
  className?: string;
  showGrid?: boolean;
  showArea?: boolean;
  height?: string;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  return (
    <div className={cn("w-full min-w-0", height ?? "h-52 sm:h-60 lg:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />}
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
          <Tooltip content={<ChartTooltipContent formatter={fmt} />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          {lines.map((l, i) => {
            const color = l.color ?? COLORS[i % COLORS.length];
            return showArea ? (
              <Area key={l.key} type="monotone" dataKey={l.key} stroke={color} fill={color} fillOpacity={0.08} name={l.name ?? l.key} strokeWidth={2} strokeDasharray={l.dashed ? "5 5" : undefined} dot={{ r: 2, fill: color }} activeDot={{ r: 4 }} />
            ) : (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={color} name={l.name ?? l.key} strokeWidth={2} strokeDasharray={l.dashed ? "5 5" : undefined} dot={{ r: 2, fill: color }} activeDot={{ r: 4 }} />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResponsivePieChart({
  data,
  valueFormatter,
  className,
}: {
  data: { name: string; value: number }[];
  valueFormatter?: (value: number) => string;
  className?: string;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={cn("w-full min-w-0 h-52 sm:h-60", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="72%"
            innerRadius="50%"
            paddingAngle={2}
            stroke="none"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={{ strokeWidth: 1 }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltipContent formatter={(v) => `${fmt(v)} (${((v / total) * 100).toFixed(1)}%)`} />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-full min-w-0 h-52 sm:h-60 lg:h-64 animate-shimmer rounded-xl", className)}>
      <div className="flex h-full items-end gap-2 p-5">
        {[40, 70, 55, 80, 45, 65].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-surface-container-high/60" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-destructive/20 bg-destructive/5 p-6 text-center">
      <p className="text-sm text-text-muted">{message}</p>
      {onRetry && (
        <button className="rounded-lg bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
