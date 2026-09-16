export type CommissionType = "rate" | "fixed";

export function normalizeCommissionType(
  type: string | null | undefined,
): CommissionType {
  return type === "fixed" ? "fixed" : "rate";
}

export function parseCommissionValue(
  value: string | number | null | undefined,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isCommissionConfigured(
  type: string | null | undefined,
  value: string | number | null | undefined,
): boolean {
  return parseCommissionValue(value) > 0;
}
