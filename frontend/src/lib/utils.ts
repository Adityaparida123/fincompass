import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampPercent(value: unknown, fallback = 0): number {
  const n = toNumber(value, fallback);
  return Math.min(100, Math.max(0, n));
}

export function formatCurrency(amount: number, currency = "INR", locale = "en-IN") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, digits = 1) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}
