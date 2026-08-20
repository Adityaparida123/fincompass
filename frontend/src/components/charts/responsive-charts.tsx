"use client";

import { type ReactNode } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line, Area, AreaChart, PieChart, Pie, Cell, CartesianGrid, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { computeYDomain, formatCompactINR, formatPeriodLabel } from "@/lib/chart-utils";

// ─── Design Tokens ──────────────────────────────────────────────
const CHART_COLORS = {
  teal: "#2dd4bf",
  indigo: "#818cf8",
  amber: "#f59e0b",
  coral: "#f87171",
  purple: "#a78bfa",
  cyan: "#22d3ee",
  emerald: "#34d399",
  orange: "#fb923c",
} as const;

const SERIES = [CHART_COLORS.teal, CHART_COLORS.indigo, CHART_COLORS.amber, CHART_COLORS.coral, CHART_COLORS.purple, CHART_COLORS.cyan];

// ─── Chart Card Container ───────────────────────────────────────
export function ChartCard({
  title,
  subtitle,
  badge,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("chart-card rounded-xl border border-border bg-surface-card overflow-hidden", className)}>
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{title}</h3>
          {subtitle && <p className="text-xs text-text-muted/70 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {badge}
          {action}
        </div>
      </div>
      <div className={cn("px-5 pb-5", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

// ─── Premium Tooltip ────────────────────────────────────────────
function ChartTooltipContent({ active, payload, label, formatter, compact }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
  compact?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip popover-enter rounded-xl border border-border/80 bg-surface-card px-3.5 py-2.5 shadow-lg min-w-[140px]">
      {label && (
        <p className="mb-1.5 text-[11px] font-semibold text-text-muted/80 tracking-wide uppercase">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-surface-card"
                style={{ backgroundColor: entry.color, boxShadow: `0 0 0 2px ${entry.color}40` }}
              />
              <span className="text-xs text-text-muted">{entry.name}</span>
            </div>
            <span className="text-xs font-semibold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
              {formatter ? formatter(entry.value, entry.name) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
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
    <div className="chart-tooltip popover-enter rounded-xl border border-border/80 bg-surface-card px-3.5 py-2.5 shadow-lg">
      <p className="text-xs font-medium text-text-primary">{entry.name}</p>
      <p className="text-xs font-semibold font-[family-name:var(--font-jetbrains-mono)] text-primary mt-0.5">
        {formatter ? formatter(entry.value) : entry.value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── Shared Axis Config ─────────────────────────────────────────
const axisProps = {
  tick: { fontSize: 10, fill: "var(--text-muted)" },
  tickLine: false,
  axisLine: false,
};

const gridProps = {
  strokeDasharray: "3 3",
  stroke: "var(--border-subtle)",
  vertical: false,
};

// ─── Financial Trend Chart (Income vs Expenses vs Net) ──────────
export function FinancialTrendChart({
  data,
  valueFormatter,
  className,
  height,
  showLegend = true,
  showGrid = true,
}: {
  data: Record<string, unknown>[];
  valueFormatter?: (value: number, name: string) => string;
  className?: string;
  height?: string;
  showLegend?: boolean;
  showGrid?: boolean;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  const yDomain = computeYDomain(data, ["income", "expenses", "net"]);
  return (
    <div className={cn("w-full min-w-0 chart-animate", height ?? "h-56 sm:h-64 lg:h-72", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="finGradIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.teal} stopOpacity={0.2} />
              <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="finGradExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.indigo} stopOpacity={0.15} />
              <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="finGradNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.12} />
              <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid {...gridProps} />}
          <XAxis
            dataKey="period"
            tickFormatter={formatPeriodLabel}
            {...axisProps}
          />
          <YAxis
            domain={yDomain}
            tickFormatter={formatCompactINR}
            {...axisProps}
          />
          <Tooltip content={<ChartTooltipContent formatter={fmt} />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke={CHART_COLORS.teal}
            strokeWidth={2.5}
            fill="url(#finGradIncome)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.teal, fill: "var(--surface-card)" }}
            animationDuration={800}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke={CHART_COLORS.indigo}
            strokeWidth={2}
            fill="url(#finGradExpense)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.indigo, fill: "var(--surface-card)" }}
            animationDuration={800}
            animationEasing="ease-out"
            animationBegin={200}
          />
          <Area
            type="monotone"
            dataKey="net"
            name="Net Cash Flow"
            stroke={CHART_COLORS.amber}
            strokeWidth={1.5}
            fill="url(#finGradNet)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_COLORS.amber, fill: "var(--surface-card)" }}
            animationDuration={800}
            animationEasing="ease-out"
            animationBegin={400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Cash Flow Trend Chart ──────────────────────────────────────
export function CashFlowTrendChart({
  data,
  valueFormatter,
  className,
  height,
  showGrid = true,
}: {
  data: Record<string, unknown>[];
  valueFormatter?: (value: number, name: string) => string;
  className?: string;
  height?: string;
  showGrid?: boolean;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  const yDomain = computeYDomain(data, ["income", "expenses", "net"]);
  return (
    <div className={cn("w-full min-w-0 chart-animate", height ?? "h-56 sm:h-64 lg:h-72", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cfGradIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.teal} stopOpacity={0.2} />
              <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cfGradExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.indigo} stopOpacity={0.15} />
              <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cfGradNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.15} />
              <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid {...gridProps} />}
          <XAxis dataKey="period" tickFormatter={formatPeriodLabel} {...axisProps} />
          <YAxis domain={yDomain} tickFormatter={formatCompactINR} {...axisProps} />
          <Tooltip content={<ChartTooltipContent formatter={fmt} />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Area type="monotone" dataKey="income" name="Income" stroke={CHART_COLORS.teal} strokeWidth={2} fill="url(#cfGradIncome)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.teal, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke={CHART_COLORS.indigo} strokeWidth={2} fill="url(#cfGradExpense)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.indigo, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" animationBegin={200} />
          <Area type="monotone" dataKey="net" name="Net" stroke={CHART_COLORS.amber} strokeWidth={2} fill="url(#cfGradNet)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.amber, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" animationBegin={400} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Forecast Chart (with confidence band) ──────────────────────
export function ForecastChart({
  data,
  valueFormatter,
  className,
  height,
  showGrid = true,
}: {
  data: Record<string, unknown>[];
  valueFormatter?: (value: number, name: string) => string;
  className?: string;
  height?: string;
  showGrid?: boolean;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  const yDomain = computeYDomain(data, ["expected", "upper", "lower"]);
  return (
    <div className={cn("w-full min-w-0 chart-animate", height ?? "h-52 sm:h-60 lg:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fcGradForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.teal} stopOpacity={0.15} />
              <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fcGradConfidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.08} />
              <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid {...gridProps} />}
          <XAxis dataKey="period" tickFormatter={formatPeriodLabel} {...axisProps} />
          <YAxis domain={yDomain} tickFormatter={formatCompactINR} {...axisProps} />
          <Tooltip content={<ChartTooltipContent formatter={fmt} />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Area type="monotone" dataKey="upper" name="Upper Bound" stroke="none" fill="url(#fcGradConfidence)" strokeDasharray="0" animationDuration={600} />
          <Area type="monotone" dataKey="lower" name="Lower Bound" stroke="none" fill="var(--surface-card)" animationDuration={600} />
          <Area type="monotone" dataKey="expected" name="Expected" stroke={CHART_COLORS.teal} strokeWidth={2.5} fill="url(#fcGradForecast)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.teal, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" />
          <Line type="monotone" dataKey="lower" name="Lower" stroke={CHART_COLORS.amber} strokeWidth={1} strokeDasharray="4 4" dot={false} opacity={0.5} />
          <Line type="monotone" dataKey="upper" name="Upper" stroke={CHART_COLORS.amber} strokeWidth={1} strokeDasharray="4 4" dot={false} opacity={0.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Category Donut Chart ───────────────────────────────────────
export function CategoryDonut({
  data,
  valueFormatter,
  className,
  height,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number }[];
  valueFormatter?: (value: number) => string;
  className?: string;
  height?: string;
  centerLabel?: string;
  centerValue?: string;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data.length || total === 0) {
    return (
      <div className={cn("w-full min-w-0 flex items-center justify-center text-sm text-text-muted", height ?? "h-56 sm:h-64", className)}>
        No category data available.
      </div>
    );
  }

  return (
    <div className={cn("w-full min-w-0 chart-animate", height ?? "h-56 sm:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="78%"
            innerRadius="55%"
            paddingAngle={3}
            stroke="none"
            animationDuration={800}
            animationEasing="ease-out"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={{ strokeWidth: 1, stroke: "var(--text-muted)" }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES[i % SERIES.length]} className="transition-opacity duration-200 hover:opacity-80" />
            ))}
          </Pie>
          <Tooltip content={<PieTooltipContent formatter={(v) => `${fmt(v)} (${((v / total) * 100).toFixed(1)}%)`} />} />
          {centerLabel && centerValue && (
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" className="fill-text-primary text-lg font-bold" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {centerValue}
            </text>
          )}
          {centerLabel && centerValue && (
            <text x="50%" y="56%" textAnchor="middle" dominantBaseline="central" className="fill-text-muted text-[10px] font-semibold uppercase" style={{ letterSpacing: "0.06em" }}>
              {centerLabel}
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Bar Chart (legacy, adaptive Y-axis) ────────────────────────
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
  const yDomain = computeYDomain(data, bars.map((b) => b.key));
  return (
    <div className={cn("w-full min-w-0 chart-animate", height ?? "h-52 sm:h-60 lg:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {showGrid && <CartesianGrid {...gridProps} />}
          <XAxis dataKey={xKey} tickFormatter={formatPeriodLabel} {...axisProps} />
          <YAxis domain={yDomain} tickFormatter={formatCompactINR} {...axisProps} />
          <Tooltip content={<ChartTooltipContent formatter={fmt} />} cursor={{ fill: "var(--surface-container-high)", opacity: 0.3 }} />
          {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />}
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} fill={b.color ?? SERIES[i % SERIES.length]} name={b.name ?? b.key} radius={[4, 4, 0, 0]} animationDuration={600} animationEasing="ease-out" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Generic Line/Area Chart (backward compat, adaptive Y-axis) ─
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
  const yDomain = computeYDomain(data, lines.map((l) => l.key));
  return (
    <div className={cn("w-full min-w-0 chart-animate", height ?? "h-52 sm:h-60 lg:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {showGrid && <CartesianGrid {...gridProps} />}
          <XAxis dataKey={xKey} tickFormatter={formatPeriodLabel} {...axisProps} />
          <YAxis domain={yDomain} tickFormatter={formatCompactINR} {...axisProps} />
          <Tooltip content={<ChartTooltipContent formatter={fmt} />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          {lines.map((l, i) => {
            const color = l.color ?? SERIES[i % SERIES.length];
            return showArea ? (
              <Area key={l.key} type="monotone" dataKey={l.key} stroke={color} fill={color} fillOpacity={0.08} name={l.name ?? l.key} strokeWidth={2} strokeDasharray={l.dashed ? "5 5" : undefined} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: color, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" />
            ) : (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={color} name={l.name ?? l.key} strokeWidth={2} strokeDasharray={l.dashed ? "5 5" : undefined} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: color, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Legacy Pie Chart (backward compat) ─────────────────────────
export function ResponsivePieChart({
  data,
  valueFormatter,
  className,
}: {
  data: { name: string; value: number }[];
  valueFormatter?: (value: number) => string;
  className?: string;
}) {
  return <CategoryDonut data={data} valueFormatter={valueFormatter} className={className} />;
}

// ─── Budget Progress List ───────────────────────────────────────
export function BudgetProgressList({
  budgets,
  valueFormatter,
  className,
}: {
  budgets: Array<{ id: string | number; category: string; spent: number; limit: number; percentUsed: number; remaining: number }>;
  valueFormatter?: (value: number) => string;
  className?: string;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  return (
    <div className={cn("space-y-3", className)}>
      {budgets.map((b) => {
        const pct = Math.min(100, Math.max(0, b.percentUsed));
        const over = b.percentUsed > 100;
        const nearing = b.percentUsed > 80 && !over;
        const healthy = !over && !nearing;
        return (
          <div key={b.id} className="budget-row group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("w-2 h-2 rounded-full shrink-0", over ? "bg-destructive" : nearing ? "bg-warning" : "bg-primary")} />
                <span className="text-sm font-medium text-text-primary capitalize truncate">{b.category}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-text-muted font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
                  {fmt(b.spent)} / {fmt(b.limit)}
                </span>
                {over && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">Over</span>}
                {nearing && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-warning/10 text-warning border border-warning/20">Near</span>}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className={cn("h-full rounded-full progress-animate", over ? "bg-destructive" : nearing ? "bg-warning" : "bg-primary")}
                style={{ width: `${pct}%`, animationDelay: "100ms" }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-text-muted font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
                {b.percentUsed.toFixed(1)}% used
              </span>
              <span className={cn("text-[11px] font-medium font-[family-name:var(--font-jetbrains-mono)] tabular-nums", b.remaining < 0 ? "text-destructive" : "text-primary")}>
                {b.remaining < 0 ? "-" : ""}{fmt(Math.abs(b.remaining))} remaining
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart Skeleton ─────────────────────────────────────────────
export function ChartSkeleton({ className, variant = "bar" }: { className?: string; variant?: "bar" | "area" | "donut" }) {
  if (variant === "donut") {
    return (
      <div className={cn("w-full min-w-0 h-52 sm:h-60 animate-shimmer rounded-full aspect-square mx-auto max-w-[240px]", className)} />
    );
  }
  return (
    <div className={cn("w-full min-w-0 h-52 sm:h-60 lg:h-64 animate-shimmer rounded-xl", className)}>
      {variant === "area" ? (
        <svg className="w-full h-full opacity-30" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path d="M0,150 Q50,120 100,130 T200,100 T300,110 T400,80 V200 H0Z" fill="var(--primary)" opacity="0.3" />
          <path d="M0,160 Q50,140 100,150 T200,120 T300,130 T400,110 V200 H0Z" fill="var(--expense)" opacity="0.2" />
        </svg>
      ) : (
        <div className="flex h-full items-end gap-2 p-5">
          {[40, 70, 55, 80, 45, 65].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-surface-container-high/60" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page Error ─────────────────────────────────────────────────
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
