import { goto } from "$app/navigation";
import { createDateNavigation } from "$lib/composables/use-date-navigation.svelte";
import {
  ALL_TIME_RANGE_PARAM,
  fromIsoDate,
  isAllTimeDateRange,
  type DatePreset,
  type DateRange,
} from "$lib/date/navigation";
import type { Page } from "@sveltejs/kit";

export function createLoanListDateRange(getPage: () => Page) {
  const urlFrom = $derived(getPage().url.searchParams.get("from"));
  const urlTo = $derived(getPage().url.searchParams.get("to"));
  const isAllTime = $derived(isAllTimeDateRange(getPage().url));
  const dateNav = createDateNavigation({
    initialPreset: isAllTime ? "all-time" : "month",
    initialRange: (() => {
      if (isAllTime) return null;
      const from = fromIsoDate(urlFrom);
      const to = fromIsoDate(urlTo);
      return from && to ? { from, to } : null;
    })(),
  });

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
    if (href === `${current.pathname}${current.search}${current.hash}`) return;
    goto(href, { replaceState: true, keepFocus: true, noScroll: true });
  }

  function applyDateRangeToUrl() {
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
    dateNav.setDatePreset("month");
    applyDateRangeToUrl();
  }

  // Client-side fallback when navigating without a full load (e.g. in-app link).
  $effect(() => {
    if (isAllTime) return;
    if (urlFrom && urlTo) return;
    dateNav.setDatePreset("month");
    applyDateRangeToUrl();
  });

  // Keep picker aligned when URL changes (back/forward, deep links).
  $effect(() => {
    if (isAllTime) {
      if (dateNav.datePreset !== "all-time") {
        dateNav.setDatePreset("all-time");
      }
      return;
    }
    if (!urlFrom || !urlTo) return;
    const from = fromIsoDate(urlFrom);
    const to = fromIsoDate(urlTo);
    if (!from || !to) return;
    const current = dateNav.getIsoRange();
    if (current.from === urlFrom && current.to === urlTo) return;
    dateNav.setDateRange({ from, to });
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
      return Boolean(urlFrom || urlTo || isAllTime);
    },
    get filterFrom() {
      if (isAllTime) return null;
      return urlFrom ?? dateNav.getIsoRange().from;
    },
    get filterTo() {
      if (isAllTime) return null;
      return urlTo ?? dateNav.getIsoRange().to;
    },
    clearDateFilter,
  };
}
