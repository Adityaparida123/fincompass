"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function ResponsiveBarChart({
  data,
  xKey,
  bars,
  valueFormatter,
  className,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; color?: string; name?: string }[];
  valueFormatter?: (value: number, name: string) => string;
  className?: string;
}) {
  return (
    <div className={cn("h-64 w-full min-w-0 sm:h-72 lg:h-80", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={valueFormatter ? (value: unknown, name: unknown) => [valueFormatter(Number(value), String(name)), String(name)] : undefined}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((b, i) => (
            <Bar key={b.key} dataKey={b.key} fill={b.color ?? COLORS[i % COLORS.length]} name={b.name ?? b.key} radius={[4, 4, 0, 0]} />
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
  className,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  lines: { key: string; color?: string; name?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("h-64 w-full min-w-0 sm:h-72 lg:h-80", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l, i) => (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color ?? COLORS[i % COLORS.length]} name={l.name ?? l.key} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResponsivePieChart({
  data,
  className,
}: {
  data: { name: string; value: number }[];
  className?: string;
}) {
  return (
    <div className={cn("h-64 w-full min-w-0 sm:h-72", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-xl bg-muted sm:h-72 lg:h-80" />;
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-8 text-center">
      <p className="text-muted-foreground">{message}</p>
      {onRetry && (
        <button className="text-sm text-primary hover:underline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
