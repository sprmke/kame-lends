import { replaceStateWhenRouterReady } from "$lib/replace-state-when-ready";
import { untrack } from "svelte";
import { createDateNavigation } from "$lib/composables/use-date-navigation.svelte";
import { shouldSkipUrlToDateNavSync } from "$lib/loan-list-date-range-sync";
import {
  readRememberedDateRange,
  writeRememberedDateRange,
  type RememberedDateRange,
} from "$lib/date/remembered-date-range";
import {
  ALL_TIME_RANGE_PARAM,
  DEFAULT_DATE_PRESET,
  fromIsoDate,
  isAllTimeDateRange,
  isCurrentPeriod,
  type DatePreset,
  type DateRange,
} from "$lib/date/navigation";
import type { Page } from "@sveltejs/kit";

type Options = {
  enabled?: boolean;
  defaultPreset?: DatePreset;
  /** localStorage scope. `loans` also writes the cookie the list load reads. */
  rememberScope?: string;
};

type OptionsInput = Options | (() => Options);

function resolveOptions(input: OptionsInput): Options {
  return typeof input === "function" ? input() : input;
}

export function createLoanListDateRange(
  getPage: () => Page,
  optionsInput: OptionsInput = {},
) {
  const getOptions = () => resolveOptions(optionsInput);
  const enabled = $derived(getOptions().enabled !== false);
  const defaultPreset = $derived(
    getOptions().defaultPreset ?? DEFAULT_DATE_PRESET,
  );

  const initialUrl = getPage().url;
  const initialOpts = getOptions();
  const initialAllTime = isAllTimeDateRange(initialUrl);
  const initialFrom = fromIsoDate(initialUrl.searchParams.get("from"));
  const initialTo = fromIsoDate(initialUrl.searchParams.get("to"));
  const initialRemembered =
    !initialAllTime && !initialFrom && !initialTo && initialOpts.rememberScope
      ? readRememberedDateRange(initialOpts.rememberScope)
      : null;
  const rememberedFrom = fromIsoDate(initialRemembered?.from);
  const rememberedTo = fromIsoDate(initialRemembered?.to);

  const dateNav = createDateNavigation({
    initialPreset: initialAllTime
      ? "all-time"
      : (initialRemembered?.preset ??
        initialOpts.defaultPreset ??
        DEFAULT_DATE_PRESET),
    initialRange: initialAllTime
      ? null
      : initialFrom && initialTo
        ? { from: initialFrom, to: initialTo }
        : rememberedFrom && rememberedTo
          ? { from: rememberedFrom, to: rememberedTo }
          : null,
  });

  let pendingFrom: string | null = null;
  let pendingTo: string | null = null;
  let pendingAllTime = false;

  const urlFrom = $derived(getPage().url.searchParams.get("from"));
  const urlTo = $derived(getPage().url.searchParams.get("to"));
  const isAllTime = $derived(isAllTimeDateRange(getPage().url));

  function markPendingFromNav() {
    if (dateNav.datePreset === "all-time") {
      pendingAllTime = true;
      pendingFrom = null;
      pendingTo = null;
      return;
    }
    pendingAllTime = false;
    const { from, to } = dateNav.getIsoRange();
    pendingFrom = from;
    pendingTo = to;
  }

  function clearPendingIfUrlMatches() {
    const url = getPage().url;
    if (pendingAllTime && isAllTimeDateRange(url)) {
      pendingAllTime = false;
      return;
    }
    if (!pendingFrom || !pendingTo) return;
    const urlFrom = url.searchParams.get("from");
    const urlTo = url.searchParams.get("to");
    if (urlFrom === pendingFrom && urlTo === pendingTo) {
      pendingFrom = null;
      pendingTo = null;
    }
  }

  function patchDateParams(
    from: string | null,
    to: string | null,
    allTime: boolean,
  ) {
    const current = getPage().url;
    const url = new URL(current);
    if (allTime) {
      url.searchParams.set("range", ALL_TIME_RANGE_PARAM);
      url.searchParams.delete("from");
      url.searchParams.delete("to");
    } else {
      url.searchParams.delete("range");
      if (from) url.searchParams.set("from", from);
      else url.searchParams.delete("from");
      if (to) url.searchParams.set("to", to);
      else url.searchParams.delete("to");
    }
    const href = `${url.pathname}${url.search}${url.hash}`;
    if (href === `${current.pathname}${current.search}${current.hash}`) {
      clearPendingIfUrlMatches();
      return;
    }
    replaceStateWhenRouterReady(href, getPage().state);
    clearPendingIfUrlMatches();
  }

  function persistRange() {
    const scope = getOptions().rememberScope;
    if (!scope) return;
    const value: RememberedDateRange =
      dateNav.datePreset === "all-time"
        ? { preset: "all-time", from: null, to: null }
        : { preset: dateNav.datePreset, ...dateNav.getIsoRange() };
    writeRememberedDateRange(scope, value);
  }

  function applyDateRangeToUrl() {
    markPendingFromNav();
    persistRange();
    if (dateNav.datePreset === "all-time") {
      patchDateParams(null, null, true);
      return;
    }
    const { from, to } = dateNav.getIsoRange();
    patchDateParams(from, to, false);
  }

  function setDatePreset(preset: DatePreset) {
    dateNav.setDatePreset(preset);
    applyDateRangeToUrl();
  }

  function setDateRange(range: DateRange) {
    dateNav.setDateRange(range);
    applyDateRangeToUrl();
  }

  function navigatePeriod(direction: "prev" | "next") {
    dateNav.navigatePeriod(direction);
    applyDateRangeToUrl();
  }

  function goToToday() {
    dateNav.goToToday();
    applyDateRangeToUrl();
  }

  function clearDateFilter() {
    dateNav.setDatePreset(getOptions().defaultPreset ?? DEFAULT_DATE_PRESET);
    applyDateRangeToUrl();
  }

  function restoreRememberedRange(): boolean {
    const scope = getOptions().rememberScope;
    if (!scope) return false;
    const remembered = readRememberedDateRange(scope);
    if (!remembered) return false;
    if (remembered.preset === "all-time") {
      dateNav.setDatePreset("all-time");
      applyDateRangeToUrl();
      return true;
    }
    const from = fromIsoDate(remembered.from);
    const to = fromIsoDate(remembered.to);
    if (!from || !to) return false;
    dateNav.setDateRange({ from, to });
    applyDateRangeToUrl();
    return true;
  }

  // Saved range, then the scope default, when the URL has no dates.
  $effect(() => {
    if (!enabled) return;
    if (isAllTimeDateRange(getPage().url)) return;
    if (urlFrom || urlTo) return;
    const preset = defaultPreset;
    untrack(() => {
      if (restoreRememberedRange()) return;
      dateNav.setDatePreset(preset);
      applyDateRangeToUrl();
    });
  });

  // Keep picker aligned when URL changes (back/forward, deep links).
  $effect(() => {
    if (!enabled) return;
    const allTime = isAllTime;
    const fromParam = urlFrom;
    const toParam = urlTo;

    untrack(() => {
      if (allTime) {
        pendingAllTime = false;
        pendingFrom = null;
        pendingTo = null;
        if (dateNav.datePreset !== "all-time") {
          dateNav.setDatePreset("all-time");
          persistRange();
        }
        return;
      }

      if (!fromParam || !toParam) return;

      const from = fromIsoDate(fromParam);
      const to = fromIsoDate(toParam);
      if (!from || !to) return;

      const nav = dateNav.getIsoRange();
      if (nav.from === fromParam && nav.to === toParam) {
        clearPendingIfUrlMatches();
        return;
      }

      if (
        shouldSkipUrlToDateNavSync({
          urlFrom: fromParam,
          urlTo: toParam,
          navFrom: nav.from,
          navTo: nav.to,
          pendingFrom,
          pendingTo,
          pendingAllTime,
          urlIsAllTime: allTime,
        })
      ) {
        return;
      }

      pendingAllTime = false;
      pendingFrom = null;
      pendingTo = null;
      dateNav.setDateRange({ from, to });
      persistRange();
    });
  });

  return {
    get dateRange() {
      return dateNav.dateRange;
    },
    get datePreset() {
      return dateNav.datePreset;
    },
    setDatePreset,
    setDateRange,
    navigatePeriod,
    goToToday,
    get isDateFilterActive() {
      if (!enabled) return false;
      if (pendingRangeActive()) return true;

      const targetDefault = defaultPreset ?? DEFAULT_DATE_PRESET;

      if (targetDefault === "all-time") {
        if (dateNav.datePreset === "all-time") return false;
        return true;
      }

      if (isAllTime) return true;

      const preset = dateNav.datePreset;
      if (preset === "all-time" || preset === "custom") return true;
      if (preset !== targetDefault) return true;

      return !isCurrentPeriod(dateNav.dateRange.from, preset);
    },
    get filterFrom() {
      if (!enabled) return null;
      if (isAllTime) return null;
      if (dateNav.datePreset === "all-time") return null;
      return dateNav.getIsoRange().from;
    },
    get filterTo() {
      if (!enabled) return null;
      if (isAllTime) return null;
      if (dateNav.datePreset === "all-time") return null;
      return dateNav.getIsoRange().to;
    },
    clearDateFilter,
  };

  function pendingRangeActive() {
    return pendingAllTime || Boolean(pendingFrom && pendingTo);
  }
}
