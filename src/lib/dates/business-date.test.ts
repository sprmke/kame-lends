import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  formatDurationBetweenKeys,
  isAfterDueDate,
  monthsBetweenKeys,
  toDateKey,
  todayKey,
} from "./business-date";

describe("business dates", () => {
  it("reads stored UTC midnight and local midnight as the same day", () => {
    expect(toDateKey("2026-09-14")).toBe("2026-09-14");
    expect(toDateKey(new Date("2026-09-14T00:00:00.000Z"))).toBe("2026-09-14");
    expect(toDateKey(new Date(2026, 8, 14))).toBe("2026-09-14");
  });

  it("uses Manila for today", () => {
    // 2026-09-13T16:00Z is 2026-09-14 00:00 in Manila.
    expect(todayKey(new Date("2026-09-13T16:00:00.000Z"))).toBe("2026-09-14");
    expect(todayKey(new Date("2026-09-13T15:59:00.000Z"))).toBe("2026-09-13");
  });

  it("is overdue the day after the due date, not on it", () => {
    expect(isAfterDueDate("2026-03-31", "2026-03-31")).toBe(false);
    expect(isAfterDueDate("2026-03-31", "2026-04-01")).toBe(true);
  });

  it("clamps month math", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("counts whole calendar months", () => {
    expect(monthsBetweenKeys("2026-01-31", "2026-03-31")).toBe(2);
    expect(monthsBetweenKeys("2026-01-31", "2026-03-30")).toBe(1);
  });

  it("formats Jan 31 to Mar 31 as two months", () => {
    expect(formatDurationBetweenKeys("2026-01-31", "2026-03-31")).toBe(
      "2 Months",
    );
    expect(formatDurationBetweenKeys("2026-01-01", "2026-01-15")).toBe(
      "2 Weeks",
    );
  });
});
