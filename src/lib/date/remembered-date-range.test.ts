import { describe, expect, it } from "vitest";
import {
  parseRememberedDateRange,
  serializeRememberedDateRange,
} from "./remembered-date-range";
import { loanListDateRangeRedirectSearch } from "$lib/loan-list-date-range-server";

describe("remembered date range", () => {
  it("round-trips a month range and rejects junk", () => {
    const value = {
      preset: "month" as const,
      from: "2026-10-01",
      to: "2026-10-31",
    };
    expect(
      parseRememberedDateRange(serializeRememberedDateRange(value)),
    ).toEqual(value);
    expect(parseRememberedDateRange("nope")).toBeNull();
    expect(parseRememberedDateRange("month:2026-13-01:2026-10-31")).toBeNull();
    expect(parseRememberedDateRange("month:2026-10-31:2026-10-01")).toBeNull();
    expect(parseRememberedDateRange("all-time")).toEqual({
      preset: "all-time",
      from: null,
      to: null,
    });
  });

  it("redirects a bare loans URL to the current month", () => {
    const target = loanListDateRangeRedirectSearch(
      new URL("http://localhost/loans?scope=mine"),
      null,
      new Date(2026, 9, 22),
    );
    expect(target).toBe("/loans?scope=mine&from=2026-10-01&to=2026-10-31");
  });

  it("uses the saved range when the URL has no dates", () => {
    const target = loanListDateRangeRedirectSearch(
      new URL("http://localhost/loans"),
      "year:2025-01-01:2025-12-31",
      new Date(2026, 9, 22),
    );
    expect(target).toBe("/loans?from=2025-01-01&to=2025-12-31");
  });

  it("leaves an explicit range alone", () => {
    const target = loanListDateRangeRedirectSearch(
      new URL("http://localhost/loans?from=2026-03-01&to=2026-03-31"),
      "year:2025-01-01:2025-12-31",
      new Date(2026, 9, 22),
    );
    expect(target).toBeNull();
  });

  it("restores all-time from the saved value", () => {
    const target = loanListDateRangeRedirectSearch(
      new URL("http://localhost/loans?scope=mine"),
      "all-time",
      new Date(2026, 9, 22),
    );
    expect(target).toBe("/loans?scope=mine&range=all");
  });
});
