import { replaceStateWhenRouterReady } from "$lib/replace-state-when-ready";
import { untrack } from "svelte";
import {
  compactListFilterValues,
  listFilterHref,
  listFilterValuesEqual,
  mergeListFilterSources,
  readRememberedListFilters,
  readUrlListFilters,
  writeRememberedListFilters,
  type ListFilterValues,
} from "$lib/list-filter-persistence";
import type { Page } from "@sveltejs/kit";

type Options = {
  /** Stable id for localStorage (usually pathname or pathname + tab). */
  scope: string | (() => string);
  /** Query param keys owned by this sync helper. */
  keys: readonly string[];
};

export function createListFilterUrlSync(getPage: () => Page, options: Options) {
  const { keys } = options;
  const resolveScope = () =>
    typeof options.scope === "function" ? options.scope() : options.scope;
  let hydrated = false;
  let applyingExternal = false;
  let lastWatchedSearch: string | null = null;

  /** Prefer the browser URL on client so reads match the address bar during replaceState. */
  function filterSourceUrl(): URL {
    if (typeof window !== "undefined") {
      return new URL(window.location.href);
    }
    return getPage().url;
  }

  function readMergedFromLocation(): ListFilterValues {
    const url = filterSourceUrl();
    const fromUrl = readUrlListFilters(url.searchParams, keys);
    const remembered = readRememberedListFilters(resolveScope());
    return mergeListFilterSources(fromUrl, remembered, keys);
  }

  /** Call once after default state is set; applies URL or saved filters. */
  function bootstrap(
    apply: (values: ListFilterValues) => ListFilterValues,
  ): void {
    if (hydrated) return;
    hydrated = true;
    const merged = readMergedFromLocation();
    applyingExternal = true;
    let snapshot: ListFilterValues;
    try {
      snapshot = apply(merged);
    } finally {
      applyingExternal = false;
    }
    syncUrlAndStorage(snapshot, { replaceIfDifferent: true });
    lastWatchedSearch = filterSourceUrl().search;
  }

  /** Persist current filter snapshot to URL + localStorage. */
  function commit(values: ListFilterValues): void {
    if (applyingExternal) return;
    syncUrlAndStorage(values, { replaceIfDifferent: true });
  }

  function syncUrlAndStorage(
    values: ListFilterValues,
    opts: { replaceIfDifferent: boolean },
  ): void {
    const compact = compactListFilterValues(values);
    writeRememberedListFilters(resolveScope(), compact);

    const current = getPage().url;
    const fromUrl = readUrlListFilters(current.searchParams, keys);
    if (
      opts.replaceIfDifferent &&
      listFilterValuesEqual(compact, fromUrl, keys)
    ) {
      return;
    }

    const href = listFilterHref(current, compact, keys);
    const currentHref = `${current.pathname}${current.search}${current.hash}`;
    if (href === currentHref) return;
    replaceStateWhenRouterReady(href, getPage().state);
  }

  /** Re-apply when the user navigates with back/forward. */
  function watch(apply: (values: ListFilterValues) => ListFilterValues): void {
    if (!hydrated) return;
    const url = filterSourceUrl();
    const kitSearch = getPage().url.search;
    if (kitSearch !== url.search) return;
    if (url.search === lastWatchedSearch) return;
    lastWatchedSearch = url.search;
    const fromUrl = readUrlListFilters(url.searchParams, keys);
    untrack(() => {
      applyingExternal = true;
      try {
        apply(fromUrl);
      } finally {
        applyingExternal = false;
      }
    });
  }

  function clearStorage(): void {
    writeRememberedListFilters(resolveScope(), {});
  }

  return {
    bootstrap,
    commit,
    watch,
    clearStorage,
    get keys() {
      return keys;
    },
  };
}
