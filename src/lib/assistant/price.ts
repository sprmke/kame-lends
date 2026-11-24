import {
  HIDDEN_CURRENCY_DISPLAY,
  HIDDEN_PERCENTAGE_DISPLAY,
  isSensitiveDataHidden,
} from "$lib/price-visibility";

const MONEY = /₱\s?-?[\d,]+(?:\.\d{2})?/g;
const PERCENT = /\b\d+(?:\.\d+)?%/g;

/**
 * Masks money and percentages when the app's price-visibility setting is on.
 * Call inside a template or `$derived` so the rune store is tracked.
 */
export function maskPrices(value: string): string {
  if (!isSensitiveDataHidden()) return value;
  return value
    .replace(MONEY, HIDDEN_CURRENCY_DISPLAY)
    .replace(PERCENT, HIDDEN_PERCENTAGE_DISPLAY);
}
