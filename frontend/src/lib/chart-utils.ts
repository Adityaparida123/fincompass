/**
 * Reusable chart utilities for adaptive financial data visualizations.
 * Handles Y-axis scaling, INR compact formatting, tick sampling, and data normalization.
 * All functions are pure — they do not modify the underlying financial data.
 */

// ─── Adaptive Y-Axis Domain ─────────────────────────────────────

/**
 * Compute sensible Y-axis domain with 15% padding above the max.
 * Returns [0, maxWithPadding] — never returns negative minimum.
 */
export function computeYDomain(
  data: Record<string, unknown>[],
  keys: string[],
): [number, number] {
  let max = 0;
  for (const point of data) {
    for (const key of keys) {
      const v = Number(point[key]);
      if (Number.isFinite(v) && v > max) max = v;
    }
  }
  if (max === 0) return [0, 100];
  const padded = max * 1.15;
  return [0, padded];
}

// ─── Compact INR Formatting ─────────────────────────────────────

/**
 * Format large INR values compactly for axis labels.
 *
 * ₹500       → ₹500
 * ₹1,200     → ₹1.2K
 * ₹50,000    → ₹50K
 * ₹1,50,000  → ₹1.5L
 * ₹35,00,000 → ₹35L
 */
export function formatCompactINR(value: number): string {
  if (value === 0) return "₹0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) {
    const v = abs / 1e7;
    return `${sign}₹${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}Cr`;
  }
  if (abs >= 1e5) {
    const v = abs / 1e5;
    return `${sign}₹${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}L`;
  }
  if (abs >= 1e3) {
    const v = abs / 1e3;
    return `${sign}₹${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

// ─── Smart Tick Sampling ────────────────────────────────────────

/**
 * Sample axis tick values to avoid crowding.
 * Guarantees min, max, and first value are always included.
 */
export function sampleTicks(values: string[], maxTicks = 8): string[] {
  if (values.length <= maxTicks) return values;
  const step = Math.max(1, Math.floor((values.length - 1) / (maxTicks - 1)));
  const sampled: string[] = [];
  for (let i = 0; i < values.length; i += step) {
    sampled.push(values[i]);
  }
  if (sampled[sampled.length - 1] !== values[values.length - 1]) {
    sampled.push(values[values.length - 1]);
  }
  return sampled;
}

// ─── X-Axis Tick Selection ──────────────────────────────────────

/**
 * Given all data points and their period labels, return which indices
 * should display tick labels to avoid crowding.
 */
export function selectXTickIndices(
  dataLength: number,
  maxTicks: number = 8,
): number[] {
  if (dataLength <= maxTicks) {
    return Array.from({ length: dataLength }, (_, i) => i);
  }
  const indices: number[] = [];
  const step = (dataLength - 1) / (maxTicks - 1);
  for (let i = 0; i < maxTicks; i++) {
    indices.push(Math.round(i * step));
  }
  // Always include last index
  if (indices[indices.length - 1] !== dataLength - 1) {
    indices[indices.length - 1] = dataLength - 1;
  }
  return indices;
}

// ─── Format Period Label ────────────────────────────────────────

/**
 * Convert "YYYY-MM" → "Jan '26", "YYYY-MM-DD" → "Aug 5", etc.
 */
export function formatPeriodLabel(period: string): string {
  if (!period) return "";
  const parts = period.split("-");
  if (parts.length === 2) {
    // YYYY-MM
    const [y, m] = parts;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mi = parseInt(m, 10) - 1;
    if (mi >= 0 && mi < 12) {
      return `${monthNames[mi]} '${y!.slice(2)}`;
    }
  }
  if (parts.length === 3) {
    // YYYY-MM-DD
    const [, m, d] = parts;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mi = parseInt(m!, 10) - 1;
    if (mi >= 0 && mi < 12) {
      return `${monthNames[mi]} ${parseInt(d!, 10)}`;
    }
  }
  return period;
}

// ─── Weekly Fill ────────────────────────────────────────────────

/**
 * Ensure all 7 days of the current week are present in the data.
 * Uses the provided day breakdown and fills missing days with 0.
 * Returns array sorted by day order (Mon → Sun).
 */
export function fillWeeklyDays(
  dailyBreakdown: Record<string, string | number>,
): { day: string; amount: number }[] {
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return dayOrder.map((day) => ({
    day: day.slice(0, 3),
    amount: Number(dailyBreakdown[day]) || 0,
  }));
}

// ─── Series Keys Helper ─────────────────────────────────────────

/**
 * Extract numeric values for given keys across all data points.
 */
export function extractValues(
  data: Record<string, unknown>[],
  keys: string[],
): number[] {
  const values: number[] = [];
  for (const point of data) {
    for (const key of keys) {
      const v = Number(point[key]);
      if (Number.isFinite(v)) values.push(v);
    }
  }
  return values;
}
