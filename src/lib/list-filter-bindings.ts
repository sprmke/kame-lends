import type { ListFilterValues } from "$lib/list-filter-persistence";

export function filterString(
  values: ListFilterValues,
  key: string,
  defaultValue = "",
): string {
  const raw = values[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0] ?? defaultValue;
  return defaultValue;
}

export function filterStringArray(
  values: ListFilterValues,
  key: string,
  defaultValue: string[] = [],
): string[] {
  const raw = values[key];
  if (typeof raw === "string") return raw ? [raw] : defaultValue;
  if (Array.isArray(raw)) return raw.length > 0 ? [...raw] : defaultValue;
  return defaultValue;
}

export function filterEnum<T extends string>(
  values: ListFilterValues,
  key: string,
  defaultValue: T,
  allowed: readonly T[],
): T {
  const raw = filterString(values, key, defaultValue);
  return (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : defaultValue;
}

export function filterBooleanParam(
  values: ListFilterValues,
  key: string,
  defaultValue = false,
): boolean {
  const raw = filterString(values, key, defaultValue ? "1" : "");
  return raw === "1" || raw === "true" || raw === "show";
}
