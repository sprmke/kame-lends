/** Prefix for object keys stored in Cloudflare R2 (see `src/lib/server/storage/`). */
export const STORAGE_REF_PREFIX = "storage:";

const DATA_IMAGE_PREFIXES = [
  "data:image/jpeg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
] as const;

export function isDataImageUrl(value: string): boolean {
  return DATA_IMAGE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function isStorageRef(value: string): boolean {
  return value.startsWith(STORAGE_REF_PREFIX);
}

export function parseStorageKey(ref: string): string | null {
  if (!isStorageRef(ref)) return null;
  const key = ref.slice(STORAGE_REF_PREFIX.length).trim();
  if (!key || key.includes("..")) return null;
  return key;
}

export function toStorageRef(objectKey: string): string {
  return `${STORAGE_REF_PREFIX}${objectKey}`;
}

/** Browser `img` src for a stored image ref or legacy data URL. */
export function imagePreviewSrc(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (isDataImageUrl(trimmed)) return trimmed;
  if (isStorageRef(trimmed)) {
    return `/api/storage/object?ref=${encodeURIComponent(trimmed)}`;
  }
  return null;
}

export function normalizeStoredImageRef(
  value: unknown,
  maxDataUrlLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isStorageRef(trimmed)) {
    const key = parseStorageKey(trimmed);
    if (!key || key.length > 512) return null;
    return trimmed;
  }

  if (!isDataImageUrl(trimmed)) return null;
  if (trimmed.length > maxDataUrlLength) return null;
  return trimmed;
}
