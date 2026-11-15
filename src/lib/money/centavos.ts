/**
 * Integer-centavo money math.
 *
 * Every money value in the ledger is an integer number of centavos. Parsing
 * and rate multiplication are the only two places decimals exist, and both
 * round half-up to the nearest centavo. Sums of rounded parts are exact.
 *
 * A JS number is exact for integers up to 2^53 (~₱90 trillion in centavos),
 * so no decimal library is needed.
 */

export const CENTAVOS_PER_PESO = 100;

/** The old code compared money with a 0.02 tolerance copied into 6 files. */
export const AMOUNT_TOLERANCE_CENTAVOS = 0;

export type MoneyInput = string | number | null | undefined;

/**
 * Parse a decimal money value to integer centavos, rounding half-up.
 * Non-finite or unparseable input is treated as 0 so a bad row can never
 * become NaN in a total.
 */
export function toCentavos(value: MoneyInput): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return roundHalfUp(value * CENTAVOS_PER_PESO);
  }

  const text = value.trim();
  if (!text) return 0;

  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const whole = match[2] ? Number(match[2]) : 0;
  const fraction = match[3] ?? "";
  const centavosText = `${fraction}000`.slice(0, 3);
  const twoDigits = Number(centavosText.slice(0, 2));
  const thirdDigit = Number(centavosText[2] ?? "0");
  const rounded = thirdDigit >= 5 ? 1 : 0;

  return sign * (whole * CENTAVOS_PER_PESO + twoDigits + rounded);
}

/** Round a fractional centavo value half-up (toward +∞ for positives). */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

/** Centavos → a decimal string with exactly two places (no symbol). */
export function fromCentavos(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(centavos));
  return `${sign}${Math.floor(absolute / CENTAVOS_PER_PESO)}.${String(
    absolute % CENTAVOS_PER_PESO,
  ).padStart(2, "0")}`;
}

/** Centavos → peso number (for display APIs that still expect a number). */
export function centavosToPesos(centavos: number): number {
  if (!Number.isFinite(centavos)) return 0;
  return Math.round(centavos) / CENTAVOS_PER_PESO;
}

export function addC(...values: number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value || 0), 0);
}

export function subC(left: number, right: number): number {
  return Math.round(left) - Math.round(right);
}

export function mulC(centavos: number, factor: number): number {
  return roundHalfUp(centavos * factor);
}

/**
 * Rate percent × centavos, rounded half-up.
 * `mulRate(10000000, "3.33")` = 3.33% of ₱100,000.00 = ₱3,330.00.
 */
export function mulRate(centavos: number, ratePercent: MoneyInput): number {
  const rate = toCentavos(ratePercent); // basis points (2 decimals kept)
  return roundHalfUp((centavos * rate) / (CENTAVOS_PER_PESO * 100));
}

/** Rate percent as a percentage of an amount, using centavo math. */
export function rateOf(centavos: number, amountCentavos: number): number {
  if (amountCentavos === 0) return 0;
  return (centavos / amountCentavos) * 100;
}

export function minC(left: number, right: number): number {
  return Math.min(left, right);
}

export function maxC(left: number, right: number): number {
  return Math.max(left, right);
}

export function clampC(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `₱1,234.56`. Non-finite input renders as `₱0.00`, never `₱NaN`. */
export function formatPHP(centavos: number): string {
  return pesoFormatter.format(centavosToPesos(centavos));
}
