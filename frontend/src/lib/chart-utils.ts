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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/**
 * Parse an ISO date string (e.g. "2026-08-17") and return its day-of-week name.
 */
function isoDateToDayName(iso: string): string | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return DAY_NAMES[d.getDay()];
}

/**
 * Ensure all 7 days (Mon → Sun) are present in the weekly data.
 *
 * The API returns daily_breakdown with ISO date keys (e.g. "2026-08-17"),
 * NOT English day names. This function:
 *   1. Parses each ISO key to determine its day-of-week
 *   2. Maps Mon–Sun to indices 0–6
 *   3. Fills missing days with amount = 0
 *   4. Returns exactly 7 entries sorted Mon → Sun
 */
export function fillWeeklyDays(
  dailyBreakdown: Record<string, string | number>,
): { day: string; amount: number }[] {
  const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const bucket = [0, 0, 0, 0, 0, 0, 0]; // Mon=0 ... Sun=6

  for (const [key, val] of Object.entries(dailyBreakdown)) {
    const dayName = isoDateToDayName(key);
    if (!dayName) continue;
    // Map full day name to Mon=0..Sun=6 index
    // JS: Sun=0, Mon=1, ..., Sat=6  →  We want: Mon=0, ..., Sun=6
    const jsDay = DAY_NAMES.indexOf(dayName as typeof DAY_NAMES[number]);
    const monBasedIndex = jsDay === 0 ? 6 : jsDay - 1;
    bucket[monBasedIndex] = Number(val) || 0;
  }

  return bucket.map((amount, i) => ({ day: SHORT_DAYS[i], amount }));
}

// ─── Weekly Y-Axis Domain ───────────────────────────────────────

/**
 * Compute adaptive Y-axis domain for weekly expense data.
 * Uses tighter padding for small values to avoid large empty ranges.
 */
export function computeWeeklyYDomain(
  data: Record<string, unknown>[],
  key: string,
): [number, number] {
  let max = 0;
  for (const point of data) {
    const v = Number(point[key]);
    if (Number.isFinite(v) && v > max) max = v;
  }
  if (max === 0) return [0, 1000];
  const pad = max < 1000 ? max * 0.3 : max * 0.2;
  return [0, Math.ceil((max + pad) / 100) * 100];
}

// ─── Forecast Y-Axis Domain ─────────────────────────────────────

/**
 * Compute adaptive Y-axis domain for forecast data that handles
 * large upper/lower bounds without making the expected line unreadable.
 * Always includes 0 and full lower/upper range.
 */
export function computeForecastYDomain(
  data: Record<string, unknown>[],
  expectedKey: string,
  lowerKey: string,
  upperKey: string,
): [number, number] {
  let min = 0;
  let max = 0;
  for (const point of data) {
    const e = Number(point[expectedKey]);
    const l = Number(point[lowerKey]);
    const u = Number(point[upperKey]);
    if (Number.isFinite(e)) { min = Math.min(min, e); max = Math.max(max, e); }
    if (Number.isFinite(l)) { min = Math.min(min, l); max = Math.max(max, l); }
    if (Number.isFinite(u)) { min = Math.min(min, u); max = Math.max(max, u); }
  }
  const range = max - min;
  const pad = range * 0.15;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
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
