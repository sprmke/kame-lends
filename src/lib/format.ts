/**
 * Formatting utilities for consistent display across the application
 */

import { getTodayAtMidnight, normalizeToMidnight } from "./date-utils";
import {
  isSensitiveDataHidden,
  HIDDEN_CURRENCY_DISPLAY,
  HIDDEN_PERCENTAGE_DISPLAY,
  formatSensitiveText,
  formatSensitiveCount,
  formatSensitiveSqm,
} from "./price-visibility";

export {
  formatSensitiveText,
  formatSensitiveCount,
  formatSensitiveSqm,
  isSensitiveDataHidden,
} from "./price-visibility";

/** Alias for names, titles, types, status labels, emails, etc. */
export const formatText = formatSensitiveText;

/** Alias for numeric counts shown in the UI. */
export const formatCount = formatSensitiveCount;

/** Alias for free-lot / area values. */
export const formatSqm = formatSensitiveSqm;

/**
 * Format a number or string as Philippine Peso currency
 */
export function formatCurrency(amount: string | number): string {
  if (isSensitiveDataHidden()) return HIDDEN_CURRENCY_DISPLAY;

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(numAmount);
}

/**
 * Format a number or string as Philippine Peso currency without decimals
 */
export function formatCurrencyCompact(amount: string | number): string {
  if (isSensitiveDataHidden()) return HIDDEN_CURRENCY_DISPLAY;

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
}

function trimShortAmountDecimals(formatted: string): string {
  return formatted.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/**
 * Compact amount for summary principal (e.g. 2.33M, 220k). No currency symbol.
 */
export function formatCurrencyShortAmount(amount: string | number): string {
  if (isSensitiveDataHidden()) return HIDDEN_CURRENCY_DISPLAY;

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(numAmount)) return "—";

  const abs = Math.abs(numAmount);
  if (abs >= 1_000_000) {
    const scaled = numAmount / 1_000_000;
    const absScaled = Math.abs(scaled);
    const digits = absScaled >= 100 ? 0 : absScaled >= 10 ? 1 : 3;
    return `${trimShortAmountDecimals(scaled.toFixed(digits))}M`;
  }
  if (abs >= 1_000) {
    const scaled = numAmount / 1_000;
    const absScaled = Math.abs(scaled);
    const digits = absScaled >= 100 ? 0 : absScaled >= 10 ? 1 : 2;
    return `${trimShortAmountDecimals(scaled.toFixed(digits))}k`;
  }
  return String(Math.round(numAmount));
}

/** Like `formatCurrencyShortAmount` with a leading ₱ (e.g. ₱85.12k). */
export function formatCurrencyShortAmountPhp(amount: string | number): string {
  const short = formatCurrencyShortAmount(amount);
  if (short === HIDDEN_CURRENCY_DISPLAY || short === "—") return short;
  return `₱${short}`;
}

/** Compact PHP for chart axes (e.g. ₱1.2M). */
export function formatChartAxis(amount: string | number): string {
  if (isSensitiveDataHidden()) return HIDDEN_CURRENCY_DISPLAY;

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numAmount);
}

/**
 * Format a date as a localized string (e.g., "January 1, 2024")
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date as a short localized string (e.g., "Jan 1, 2024")
 */
export function formatDateShort(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date as a very short string (e.g., "Jan 1")
 */
export function formatDateVeryShort(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Check if a date is in the future (compared to today at midnight)
 * Uses normalized date comparison for consistency across the app
 */
export function isFutureDate(date: Date | string): boolean {
  const today = getTodayAtMidnight();
  const checkDate = normalizeToMidnight(date);
  return checkDate > today;
}

/**
 * Format a percentage value
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (isSensitiveDataHidden()) return HIDDEN_PERCENTAGE_DISPLAY;
  return `${value.toFixed(decimals)}%`;
}

/** Format rate with optional "(Fixed)" suffix preserved when visible. */
export function formatRateLabel(
  value: number,
  options?: { fixed?: boolean; decimals?: number },
): string {
  if (isSensitiveDataHidden()) return HIDDEN_PERCENTAGE_DISPLAY;
  const rate = `${value.toFixed(options?.decimals ?? 2)}%`;
  return options?.fixed ? `${rate} (Fixed)` : rate;
}
