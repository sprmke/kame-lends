import {
  type DatePreset,
  type DateRange,
  detectPresetFromRange,
  getDateRangeFromPreset,
  navigateReferenceDate,
  toIsoDate,
} from "$lib/date/navigation";

type CreateDateNavigationOptions = {
  initialPreset?: DatePreset;
  initialRange?: DateRange | null;
};

export function createDateNavigation(
  options: CreateDateNavigationOptions = {},
) {
  const { initialPreset = "month", initialRange = null } = options;

  let datePreset = $state<DatePreset>(
    initialRange
      ? detectPresetFromRange(initialRange.from, initialRange.to)
      : initialPreset,
  );
  let dateRange = $state<DateRange>(
    initialRange ?? getDateRangeFromPreset(initialPreset, new Date()),
  );
  let referenceDate = $state<Date>(initialRange?.from ?? new Date());

  function setDatePreset(preset: DatePreset) {
    const now = new Date();
    datePreset = preset;
    referenceDate = now;
    dateRange = getDateRangeFromPreset(preset, now);
  }

  function setDateRange(range: DateRange) {
    dateRange = range;
    referenceDate = range.from;
    datePreset = detectPresetFromRange(range.from, range.to);
  }

  function navigatePeriod(direction: "prev" | "next") {
    if (datePreset === "custom" || datePreset === "all-time") return;
    const newRef = navigateReferenceDate(referenceDate, datePreset, direction);
    referenceDate = newRef;
    dateRange = getDateRangeFromPreset(datePreset, newRef);
  }

  function goToToday() {
    const today = new Date();
    referenceDate = today;
    dateRange = getDateRangeFromPreset(datePreset, today);
  }

  function getIsoRange() {
    return {
      from: toIsoDate(dateRange.from),
      to: toIsoDate(dateRange.to),
    };
  }

  return {
    get datePreset() {
      return datePreset;
    },
    get dateRange() {
      return dateRange;
    },
    setDatePreset,
    setDateRange,
    navigatePeriod,
    goToToday,
    getIsoRange,
  };
}
