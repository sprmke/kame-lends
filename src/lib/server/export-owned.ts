export function requestedExportIds(body: unknown): number[] | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { ids?: unknown; data?: unknown };
  if (Array.isArray(record.ids)) {
    return record.ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
  }
  if (Array.isArray(record.data)) {
    return record.data
      .map((row) => {
        if (!row || typeof row !== "object" || !("id" in row)) return NaN;
        return Number((row as { id: unknown }).id);
      })
      .filter((id) => Number.isFinite(id));
  }
  return null;
}

export function selectOwnedExportRows<T extends { id: number }>(
  owned: T[],
  ids: number[] | null,
): T[] {
  if (!ids) return owned;
  const allowed = new Set(ids);
  return owned.filter((row) => allowed.has(row.id));
}

export function parseEnabledSectionKeys(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const keys = (body as { enabledSectionKeys?: unknown }).enabledSectionKeys;
  if (!Array.isArray(keys)) return null;
  if (!keys.every((key) => typeof key === "string")) return null;
  return keys;
}
