/**
 * Route parameter helpers shared by API handlers.
 *
 * `parseInt("abc")` returns `NaN`, and `NaN` reaches a `WHERE id = NaN` query
 * as an error. Every route should use `parseIdParam` and return 400 instead.
 */
export function parseIdParam(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
