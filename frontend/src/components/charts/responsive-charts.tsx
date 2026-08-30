"use client";

import { type ReactNode } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  Line, Area, AreaChart, PieChart, Pie, Cell, CartesianGrid,
ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { computeYDomain, computeWeeklyYDomain, computeForecastYDomain, formatCompactINR, formatPeriodLabel } from "@/lib/chart-utils";

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
function ChartTooltipContent({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
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
  const isSingle = data.length <= 1;

  // Single data point: render as BarChart (AreaChart can't draw a line from 1 point)
  if (isSingle) {
    return (
      <div className={cn("w-full min-w-0 chart-animate", height ?? "h-56 sm:h-64 lg:h-72", className)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {showGrid && <CartesianGrid {...gridProps} />}
            <XAxis dataKey="period" tickFormatter={formatPeriodLabel} {...axisProps} />
            <YAxis domain={yDomain} tickFormatter={formatCompactINR} {...axisProps} />
            <Tooltip content={<ChartTooltipContent formatter={fmt} />} cursor={{ fill: "var(--surface-container-high)", opacity: 0.3 }} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
            <Bar dataKey="income" name="Income" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} animationDuration={600} />
            <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} animationDuration={600} animationBegin={100} />
            <Bar dataKey="net" name="Net Cash Flow" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} animationDuration={600} animationBegin={200} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Multiple data points: render as AreaChart with lines
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
          <XAxis dataKey="period" tickFormatter={formatPeriodLabel} {...axisProps} />
          <YAxis domain={yDomain} tickFormatter={formatCompactINR} {...axisProps} />
          <Tooltip content={<ChartTooltipContent formatter={fmt} />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
          <Area type="monotone" dataKey="income" name="Income" stroke={CHART_COLORS.teal} strokeWidth={2.5} fill="url(#finGradIncome)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.teal, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke={CHART_COLORS.indigo} strokeWidth={2} fill="url(#finGradExpense)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.indigo, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" animationBegin={200} />
          <Area type="monotone" dataKey="net" name="Net Cash Flow" stroke={CHART_COLORS.amber} strokeWidth={1.5} fill="url(#finGradNet)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: CHART_COLORS.amber, fill: "var(--surface-card)" }} animationDuration={800} animationEasing="ease-out" animationBegin={400} />
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
  const isSingle = data.length <= 1;

  if (isSingle) {
    return (
      <div className={cn("w-full min-w-0 chart-animate", height ?? "h-56 sm:h-64 lg:h-72", className)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {showGrid && <CartesianGrid {...gridProps} />}
            <XAxis dataKey="period" tickFormatter={formatPeriodLabel} {...axisProps} />
            <YAxis domain={yDomain} tickFormatter={formatCompactINR} {...axisProps} />
            <Tooltip content={<ChartTooltipContent formatter={fmt} />} cursor={{ fill: "var(--surface-container-high)", opacity: 0.3 }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="income" name="Income" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} animationDuration={600} />
            <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} animationDuration={600} animationBegin={100} />
            <Bar dataKey="net" name="Net" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} animationDuration={600} animationBegin={200} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

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

// ─── Forecast Chart (single-point range + multi-point trend) ────
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

  if (!data.length) {
    return (
      <div className={cn("w-full min-w-0 flex items-center justify-center text-sm text-text-muted", height ?? "h-52 sm:h-60 lg:h-64", className)}>
        No forecast data available
      </div>
    );
  }

  if (data.length === 1) {
    return <SinglePointForecast data={data[0]!} formatter={fmt} className={className} height={height} />;
  }

  return <MultiPointForecast data={data} formatter={fmt} className={className} height={height} showGrid={showGrid} />;
}

// ─── Combined Historical Net + Forecast Chart ──────────────────
// Shows the recent actual net cash flow joined to the ML forecast
// (expected line + confidence band) so the projection reads in context.
export function CombinedTrendForecastChart({
  historical,
  forecast,
  valueFormatter,
  className,
  height,
}: {
  historical: Record<string, unknown>[];
  forecast: Record<string, unknown>[];
  valueFormatter?: (value: number, name: string) => string;
  className?: string;
  height?: string;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));

  const histTail = historical.slice(-4).map((h) => ({
    period: h.period,
    historicalNet: Number(h.net) || 0,
    expected: null as number | null,
    lower: null as number | null,
    upper: null as number | null,
  }));

  const combined = [
    ...histTail,
    ...forecast.map((f) => {
      const expected = Number(f.expected) || 0;
      const lower = Number(f.lower) ?? expected;
      const upper = Number(f.upper) ?? expected;
      return {
        period: f.period,
        historicalNet: null as number | null,
        expected,
        lower,
        upper,
        range: upper - lower,
      };
    }),
  ];

  const hasForecast = forecast.length > 0;
  const yDomain = computeYDomain(combined, ["historicalNet", "expected", "lower", "upper"]);

  if (!combined.length) {
    return (
      <div className={cn("w-full min-w-0 flex items-center justify-center text-sm text-text-muted", height ?? "h-52 sm:h-60 lg:h-64", className)}>
        No data available
      </div>
    );
  }

  return (
    <div className={cn("w-full min-w-0 chart-animate relative", height ?? "h-52 sm:h-60 lg:h-72", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={combined} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cmbGradNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.15} />
              <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cmbGradExpected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="cmbGradBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.12} />
              <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          {yDomain[0] < 0 && (
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" strokeOpacity={0.6} />
          )}
          <XAxis
            dataKey="period"
            tickFormatter={formatPeriodLabel}
            {...axisProps}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
          />
          <YAxis domain={yDomain} tickFormatter={formatCompactINR} {...axisProps} width={56} />
          <Tooltip
            content={<CombinedForecastTooltip formatter={fmt} />}
            cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

          <Area
            type="monotone"
            dataKey="historicalNet"
            name="Actual net"
            stroke={CHART_COLORS.amber}
            strokeWidth={2}
            fill="url(#cmbGradNet)"
            dot={{ r: 3, fill: CHART_COLORS.amber }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_COLORS.amber, fill: "var(--surface-card)" }}
            connectNulls={false}
            animationDuration={600}
          />

          {hasForecast && (
            <>
              <Area type="monotone" dataKey="lower" stroke="none" fill="transparent" fillOpacity={0} name="Lower" dot={false} activeDot={false} animationDuration={600} />
              <Area type="monotone" dataKey="range" stroke="none" fill="url(#cmbGradBand)" fillOpacity={1} name="Confidence Range" dot={false} activeDot={false} animationDuration={800} animationEasing="ease-out" />
              <Area
                type="monotone"
                dataKey="expected"
                stroke={CHART_COLORS.cyan}
                strokeWidth={2.5}
                fill="url(#cmbGradExpected)"
                name="Expected"
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, stroke: CHART_COLORS.cyan, fill: "var(--surface-card)" }}
                connectNulls={false}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Line type="monotone" dataKey="upper" stroke={CHART_COLORS.cyan} strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.35} name="Upper" dot={false} activeDot={false} animationDuration={600} />
              <Line type="monotone" dataKey="lower" stroke={CHART_COLORS.cyan} strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.35} name="Lower" dot={false} activeDot={false} animationDuration={600} />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CombinedForecastTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; dataKey: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  if (!rows.length) return null;
  const fmtVal = formatter ?? ((v: number) => v.toLocaleString("en-IN"));
  return (
    <div className="chart-tooltip popover-enter rounded-xl border border-border/80 bg-surface-card px-4 py-3 shadow-lg min-w-[170px]">
      {label && <p className="mb-2 text-[11px] font-semibold text-text-muted/80 tracking-wide uppercase">{formatPeriodLabel(label)}</p>}
      <div className="space-y-1.5">
        {rows.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.dataKey === "historicalNet" ? CHART_COLORS.amber : p.dataKey === "expected" ? CHART_COLORS.cyan : "var(--text-muted)" }} />
            <span className="text-xs font-medium text-text-primary">{p.name === "Lower" || p.name === "Upper" ? (p.dataKey === "lower" ? "Low" : "High") : p.name}</span>
            <span className="ml-auto text-xs font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
              {fmtVal(Number(p.value), p.name)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Single-Point Forecast (horizontal range visualization) ─────
function SinglePointForecast({
  data,
  formatter,
  className,
  height,
}: {
  data: Record<string, unknown>;
  formatter: (value: number, name: string) => string;
  className?: string;
  height?: string;
}) {
  const period = String(data.period ?? "");
  const expected = Number(data.expected) || 0;
  const lower = Number(data.lower) || 0;
  const upper = Number(data.upper) || 0;

  const range = upper - lower;
  const clamp = (pct: number) => Math.max(3, Math.min(97, pct));

  const expectedPct = range === 0 ? 50 : clamp(((expected - lower) / range) * 100);
  const zeroInRange = lower < 0 && upper > 0;
  const zeroPct = zeroInRange ? clamp(((-lower) / range) * 100) : null;

  return (
    <div className={cn("w-full chart-animate", height ?? "h-52 sm:h-60 lg:h-64", className)}>
      <div className="flex h-full flex-col justify-center gap-4 px-3 sm:px-5">

        {/* Period label */}
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted/70">
          {formatPeriodLabel(period)}
        </p>

        {/* Range bar visualization */}
        <div className="relative h-16 sm:h-20 w-full">
          {/* Background track */}
          <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full bg-surface-container-high/60" />

          {/* Confidence band */}
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
            style={{
              left: 0,
              right: 0,
              background: `linear-gradient(90deg, ${CHART_COLORS.cyan}10, ${CHART_COLORS.cyan}18, ${CHART_COLORS.cyan}10)`,
            }}
          />

          {/* Zero line */}
          {zeroPct !== null && (
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${zeroPct}%`, backgroundColor: "var(--text-muted)", opacity: 0.3 }}
            />
          )}

          {/* Lower marker */}
          <div
            className="absolute top-1/2 flex -translate-y-1/2 items-center"
            style={{ left: "3%", transform: "translate(-50%, -50%)" }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-text-muted/30" />
          </div>

          {/* Upper marker */}
          <div
            className="absolute top-1/2 flex -translate-y-1/2 items-center"
            style={{ right: "3%", transform: "translate(50%, -50%)" }}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-text-muted/30" />
          </div>

          {/* Expected marker */}
          <div
            className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5"
            style={{ left: `${expectedPct}%`, transform: "translate(-50%, -50%)" }}
          >
            {/* Dot */}
            <div
              className="h-4 w-4 rounded-full border-[2.5px] border-solid transition-shadow duration-200 hover:h-5 hover:w-5"
              style={{
                borderColor: CHART_COLORS.cyan,
                backgroundColor: "var(--surface-card)",
                boxShadow: `0 0 10px ${CHART_COLORS.cyan}50, 0 0 20px ${CHART_COLORS.cyan}20`,
              }}
            />
          </div>
        </div>

        {/* Value labels row */}
        <div className="relative flex w-full items-start">
          {/* Lower */}
          <div className="flex w-0 flex-1 flex-col items-start pl-1">
            <span className="text-[10px] font-medium text-text-muted/50 uppercase tracking-wider">Lower</span>
            <span className="mt-0.5 text-xs font-semibold font-[family-name:var(--font-jetbrains-mono)] text-text-muted tabular-nums">
              {formatter(lower, "Lower")}
            </span>
          </div>

          {/* Expected (centered on its position) */}
          <div
            className="absolute flex flex-col items-center"
            style={{ left: `${expectedPct}%`, transform: "translateX(-50%)" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: CHART_COLORS.cyan }}>Expected</span>
            <span
              className="mt-0.5 text-sm font-bold font-[family-name:var(--font-jetbrains-mono)] tabular-nums"
              style={{ color: CHART_COLORS.cyan, textShadow: `0 0 12px ${CHART_COLORS.cyan}30` }}
            >
              {formatter(expected, "Expected")}
            </span>
          </div>

          {/* Upper */}
          <div className="flex w-0 flex-1 flex-col items-end pr-1">
            <span className="text-[10px] font-medium text-text-muted/50 uppercase tracking-wider">Upper</span>
            <span className="mt-0.5 text-xs font-semibold font-[family-name:var(--font-jetbrains-mono)] text-text-muted tabular-nums">
              {formatter(upper, "Upper")}
            </span>
          </div>
        </div>

        {/* Zero reference (when range crosses zero) */}
        {zeroInRange && zeroPct !== null && (
          <div className="relative w-full h-0">
            <div
              className="absolute -top-3 flex flex-col items-center"
              style={{ left: `${zeroPct}%`, transform: "translateX(-50%)" }}
            >
              <span className="text-[9px] font-medium text-text-muted/40">₹0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Multi-Point Forecast (AreaChart with confidence band) ──────
function MultiPointForecast({
  data,
  formatter,
  className,
  height,
  showGrid,
}: {
  data: Record<string, unknown>[];
  formatter: (value: number, name: string) => string;
  className?: string;
  height?: string;
  showGrid?: boolean;
}) {
  const yDomain = computeForecastYDomain(data, "expected", "lower", "upper");

  return (
    <div className={cn("w-full min-w-0 chart-animate relative", height ?? "h-52 sm:h-60 lg:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fcGradExpected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fcGradBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.12} />
              <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid {...gridProps} />}
          {yDomain[0] < 0 && (
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" strokeOpacity={0.6} />
          )}
          <XAxis
            dataKey="period"
            tickFormatter={formatPeriodLabel}
            {...axisProps}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
          />
          <YAxis
            domain={yDomain}
            tickFormatter={formatCompactINR}
            {...axisProps}
            width={56}
          />
          <Tooltip
            content={<ForecastMultiTooltip formatter={formatter} />}
            cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

          {/* Confidence band — lower area (transparent spacer) */}
          <Area type="monotone" dataKey="lower" stroke="none" fill="transparent" fillOpacity={0} name="Lower" dot={false} activeDot={false} animationDuration={600} isAnimationActive={true} />
          {/* Confidence band — range fill between lower and upper */}
          <Area type="monotone" dataKey="range" stroke="none" fill="url(#fcGradBand)" fillOpacity={1} name="Confidence Range" dot={false} activeDot={false} animationDuration={800} animationEasing="ease-out" isAnimationActive={true} />
          {/* Expected forecast line — primary visual element */}
          <Area
            type="monotone"
            dataKey="expected"
            stroke={CHART_COLORS.cyan}
            strokeWidth={2.5}
            fill="url(#fcGradExpected)"
            name="Expected"
            dot={false}
            activeDot={{ r: 6, strokeWidth: 2, stroke: CHART_COLORS.cyan, fill: "var(--surface-card)", style: { filter: `drop-shadow(0 0 8px ${CHART_COLORS.cyan}60)` } }}
            animationDuration={800}
            animationEasing="ease-out"
            isAnimationActive={true}
          />
          {/* Thin dashed boundary lines */}
          <Line type="monotone" dataKey="upper" stroke={CHART_COLORS.cyan} strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.35} name="Upper" dot={false} activeDot={false} animationDuration={600} isAnimationActive={true} />
          <Line type="monotone" dataKey="lower" stroke={CHART_COLORS.cyan} strokeWidth={1} strokeDasharray="4 4" strokeOpacity={0.35} name="Lower" dot={false} activeDot={false} animationDuration={600} isAnimationActive={true} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ForecastMultiTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const fmtVal = formatter ?? ((v: number) => v.toLocaleString("en-IN"));
  const expected = payload.find((p) => p.dataKey === "expected");
  const lower = payload.find((p) => p.dataKey === "lower");
  const upper = payload.find((p) => p.dataKey === "upper");

  return (
    <div className="chart-tooltip popover-enter rounded-xl border border-border/80 bg-surface-card px-4 py-3 shadow-lg min-w-[170px]">
      {label && (
        <p className="mb-2 text-[11px] font-semibold text-text-muted/80 tracking-wide uppercase">{formatPeriodLabel(label)}</p>
      )}
      <div className="space-y-1.5">
        {expected && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.cyan }} />
              <span className="text-xs font-medium text-text-primary">Expected</span>
            </div>
            <span className="text-xs font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
              {fmtVal(expected.value, expected.name)}
            </span>
          </div>
        )}
        {lower && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted/40" />
              <span className="text-xs text-text-muted">Lower</span>
            </div>
            <span className="text-xs font-[family-name:var(--font-jetbrains-mono)] text-text-muted tabular-nums">
              {fmtVal(lower.value, lower.name)}
            </span>
          </div>
        )}
        {upper && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted/40" />
              <span className="text-xs text-text-muted">Upper</span>
            </div>
            <span className="text-xs font-[family-name:var(--font-jetbrains-mono)] text-text-muted tabular-nums">
              {fmtVal(upper.value, upper.name)}
            </span>
          </div>
        )}
      </div>
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

// ─── Weekly Expenses Chart ───────────────────────────────────────
export function WeeklyExpensesChart({
  data,
  valueFormatter,
  className,
  height,
  showGrid = true,
}: {
  data: Record<string, unknown>[];
  valueFormatter?: (value: number) => string;
  className?: string;
  height?: string;
  showGrid?: boolean;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  const yDomain = computeWeeklyYDomain(data, "amount");
  const hasAnyData = data.some((d) => Number(d.amount) > 0);

  if (!data.length) {
    return (
      <div className={cn("w-full min-w-0 flex items-center justify-center text-sm text-text-muted", height ?? "h-52 sm:h-60 lg:h-64", className)}>
        No expenses recorded this week
      </div>
    );
  }

  return (
    <div className={cn("w-full min-w-0 chart-animate", height ?? "h-52 sm:h-60 lg:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.indigo} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CHART_COLORS.indigo} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid {...gridProps} />}
          <XAxis
            dataKey="day"
            {...axisProps}
            tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 500 }}
            interval={0}
          />
          <YAxis
            domain={yDomain}
            tickFormatter={formatCompactINR}
            {...axisProps}
            width={52}
          />
          <Tooltip
            content={<WeeklyTooltip formatter={fmt} />}
            cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke={CHART_COLORS.indigo}
            strokeWidth={2.5}
            fill="url(#weeklyGrad)"
            dot={{ r: 4, strokeWidth: 2, stroke: CHART_COLORS.indigo, fill: "var(--surface-card)", style: { filter: `drop-shadow(0 0 3px ${CHART_COLORS.indigo}40)` } }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: CHART_COLORS.indigo, fill: "var(--surface-card)", style: { filter: `drop-shadow(0 0 6px ${CHART_COLORS.indigo}60)` } }}
            animationDuration={800}
            animationEasing="ease-out"
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
      {!hasAnyData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-text-muted/60 font-medium">No expenses recorded this week</p>
        </div>
      )}
    </div>
  );
}

function WeeklyTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ value: number; color: string }>;
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]!.value;
  return (
    <div className="chart-tooltip popover-enter rounded-xl border border-border/80 bg-surface-card px-3.5 py-2.5 shadow-lg min-w-[120px]">
      <p className="mb-1.5 text-[11px] font-semibold text-text-muted/80 tracking-wide uppercase">{label}</p>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.indigo }} />
        <span className="text-xs text-text-muted">Expense</span>
      </div>
      <p className="mt-0.5 text-sm font-bold font-[family-name:var(--font-jetbrains-mono)] text-text-primary tabular-nums">
        {formatter ? formatter(value) : value.toLocaleString("en-IN")}
      </p>
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
  onDelete,
}: {
  budgets: Array<{ id: string | number; category: string; spent: number; limit: number; percentUsed: number; remaining: number }>;
  valueFormatter?: (value: number) => string;
  className?: string;
  onDelete?: (id: string | number) => void;
}) {
  const fmt = valueFormatter ?? ((v: number) => formatCurrency(v));
  return (
    <div className={cn("space-y-3", className)}>
      {budgets.map((b) => {
        const pct = Math.min(100, Math.max(0, b.percentUsed));
        const over = b.percentUsed > 100;
        const nearing = b.percentUsed > 80 && !over;
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
              <div className="flex items-center gap-2">
                <span className={cn("text-[11px] font-medium font-[family-name:var(--font-jetbrains-mono)] tabular-nums", b.remaining < 0 ? "text-destructive" : "text-primary")}>
                  {b.remaining < 0 ? "-" : ""}{fmt(Math.abs(b.remaining))} remaining
                </span>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(b.id)}
                    aria-label={`Delete ${b.category} budget`}
                    className="text-[10px] text-text-muted hover:text-destructive transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
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
