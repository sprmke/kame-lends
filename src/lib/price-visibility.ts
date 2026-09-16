import { priceVisibility } from "$lib/stores/price-visibility.svelte";

/** Masked currency (PHP). */
export const HIDDEN_CURRENCY_DISPLAY = "₱ ••••••";
/** Masked percentage (interest / profit rates). */
export const HIDDEN_PERCENTAGE_DISPLAY = "•••%";
/** @deprecated Non-monetary fields are no longer masked; kept for export helpers that may still import it. */
export const HIDDEN_TEXT_DISPLAY = "••••••";
/** @deprecated Dates are no longer masked. */
export const HIDDEN_DATE_DISPLAY = "•• ••, ••••";
/** @deprecated Short dates are no longer masked. */
export const HIDDEN_SHORT_DATE_DISPLAY = "•• ••";
/** @deprecated Counts are no longer masked. */
export const HIDDEN_COUNT_DISPLAY = "••";

/** When true, currency amounts and percentage rates are redacted in the UI and exports. */
export function isSensitiveDataHidden(): boolean {
  return priceVisibility.pricesHidden;
}

/** @deprecated Use {@link isSensitiveDataHidden}. */
export const arePricesHidden = isSensitiveDataHidden;

/** Names, labels, status, emails, etc. (never masked by price visibility). */
export function formatSensitiveText(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

/** Loan counts and similar integers (never masked by price visibility). */
export function formatSensitiveCount(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "0";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return String(value);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("en-PH");
}

/** Square meters (never masked by price visibility). */
export function formatSensitiveSqm(value: number | null | undefined): string {
  if (!value) return "—";
  return `${value.toLocaleString("en-PH")} sqm`;
}
