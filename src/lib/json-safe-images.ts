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

const KEEP_DATA_IMAGE_KEYS = new Set(["receiptImageUrl", "imageUrl"]);

/**
 * Recursively replace `data:image…` strings so JSON APIs never ship
 * inlined identity photos. `storage:` refs, dates, payment receipts,
 * and other values are left as-is.
 */
export function stripDataImageUrls<T>(value: T): T {
  return stripDataImageUrlsInner(value, null);
}

function stripDataImageUrlsInner<T>(value: T, key: string | null): T {
  if (typeof value === "string") {
    if (key && KEEP_DATA_IMAGE_KEYS.has(key)) return value;
    return (isDataImageUrl(value) ? null : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripDataImageUrlsInner(item, key)) as T;
  }
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const output: Record<string, unknown> = {};
    for (const [nestedKey, nested] of Object.entries(value)) {
      output[nestedKey] = stripDataImageUrlsInner(nested, nestedKey);
    }
    return output as T;
  }
  return value;
}
