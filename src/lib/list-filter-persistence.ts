/** Browser-local fallback when a list opens without filter query params. */
const STORAGE_PREFIX = "kl-list-filters:v1:";

export type ListFilterValues = Record<string, string | string[]>;

export function listFilterStorageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

export function parseRememberedListFilters(
  raw: string | null | undefined,
): ListFilterValues | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const out: ListFilterValues = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        out[key] = value;
      } else if (
        Array.isArray(value) &&
        value.every((item) => typeof item === "string")
      ) {
        out[key] = value;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function readRememberedListFilters(
  scope: string,
): ListFilterValues | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parseRememberedListFilters(
      localStorage.getItem(listFilterStorageKey(scope)),
    );
  } catch {
    return null;
  }
}

export function writeRememberedListFilters(
  scope: string,
  values: ListFilterValues,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const cleaned = compactListFilterValues(values);
    if (Object.keys(cleaned).length === 0) {
      localStorage.removeItem(listFilterStorageKey(scope));
      return;
    }
    localStorage.setItem(listFilterStorageKey(scope), JSON.stringify(cleaned));
  } catch {
    // Private mode can reject storage writes.
  }
}

export function compactListFilterValues(
  values: ListFilterValues,
): ListFilterValues {
  const out: ListFilterValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") {
      if (value !== "") out[key] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

export function readUrlListFilters(
  searchParams: URLSearchParams,
  keys: readonly string[],
): ListFilterValues {
  const out: ListFilterValues = {};
  for (const key of keys) {
    const all = searchParams.getAll(key);
    if (all.length > 1) {
      out[key] = all;
    } else if (all.length === 1) {
      out[key] = all[0]!;
    }
  }
  return out;
}

export function mergeListFilterSources(
  urlValues: ListFilterValues,
  remembered: ListFilterValues | null,
  keys: readonly string[],
): ListFilterValues {
  const out: ListFilterValues = {};
  for (const key of keys) {
    if (key in urlValues) {
      out[key] = urlValues[key]!;
    } else if (remembered && key in remembered) {
      out[key] = remembered[key]!;
    }
  }
  return out;
}

export function applyListFilterPatch(
  url: URL,
  patch: ListFilterValues,
  keys: readonly string[],
): void {
  for (const key of keys) {
    url.searchParams.delete(key);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (!keys.includes(key)) continue;
    if (typeof value === "string") {
      if (value !== "") url.searchParams.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== "") url.searchParams.append(key, item);
      }
    }
  }
}

export function listFilterHref(
  current: URL,
  patch: ListFilterValues,
  keys: readonly string[],
): string {
  const url = new URL(current);
  applyListFilterPatch(url, patch, keys);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function listFilterValuesEqual(
  a: ListFilterValues,
  b: ListFilterValues,
  keys: readonly string[],
): boolean {
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    const aStr = serializeListFilterValue(av);
    const bStr = serializeListFilterValue(bv);
    if (aStr !== bStr) return false;
  }
  return true;
}

function serializeListFilterValue(
  value: string | string[] | undefined,
): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return [...value].sort().join("\0");
}
