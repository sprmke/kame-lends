import { isDataImageUrl } from "$lib/storage-reference";

/** Drop legacy inlined data URLs. Keep storage refs and other non-data values. */
export function jsonSafeImageRef(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isDataImageUrl(trimmed)) return null;
  return trimmed;
}

/**
 * Recursively replace `data:image…` strings so JSON APIs never ship
 * inlined photos. `storage:` refs, dates, and other values are left as-is.
 */
export function stripDataImageUrls<T>(value: T): T {
  if (typeof value === "string") {
    return (isDataImageUrl(value) ? null : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripDataImageUrls(item)) as T;
  }
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = stripDataImageUrls(nested);
    }
    return output as T;
  }
  return value;
}
