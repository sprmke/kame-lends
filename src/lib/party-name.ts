/** One person per role: case, surrounding space, and repeated spaces do not make a second row. */
export function normalizePartyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Keep the oldest row for each normalized name. Blank names stay as their own rows. */
export function uniquePartiesByName<T extends { id: number; name: string }>(
  rows: T[],
): T[] {
  const keeperIdByName = new Map<string, number>();
  for (const row of rows) {
    const key = normalizePartyName(row.name);
    if (!key) continue;
    const current = keeperIdByName.get(key);
    if (current == null || row.id < current) keeperIdByName.set(key, row.id);
  }
  const keep = new Set(keeperIdByName.values());
  return rows.filter((row) => {
    const key = normalizePartyName(row.name);
    if (!key) return true;
    return keep.has(row.id);
  });
}
