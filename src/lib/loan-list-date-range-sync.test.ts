import { describe, expect, it } from "vitest";
import { shouldSkipUrlToDateNavSync } from "./loan-list-date-range-sync";

describe("shouldSkipUrlToDateNavSync", () => {
  it("skips when local nav is ahead of stale URL params", () => {
    expect(
      shouldSkipUrlToDateNavSync({
        urlFrom: "2026-09-01",
        urlTo: "2026-09-30",
        navFrom: "2026-08-01",
        navTo: "2026-08-31",
        pendingFrom: "2026-08-01",
        pendingTo: "2026-08-31",
        pendingAllTime: false,
        urlIsAllTime: false,
      }),
    ).toBe(true);
  });

  it("does not skip when URL matches pending range", () => {
    expect(
      shouldSkipUrlToDateNavSync({
        urlFrom: "2026-08-01",
        urlTo: "2026-08-31",
        navFrom: "2026-08-01",
        navTo: "2026-08-31",
        pendingFrom: "2026-08-01",
        pendingTo: "2026-08-31",
        pendingAllTime: false,
        urlIsAllTime: false,
      }),
    ).toBe(false);
  });

  it("skips all-time until range=all is on the URL", () => {
    expect(
      shouldSkipUrlToDateNavSync({
        urlFrom: "2026-09-01",
        urlTo: "2026-09-30",
        navFrom: "2026-01-01",
        navTo: "2026-12-31",
        pendingFrom: null,
        pendingTo: null,
        pendingAllTime: true,
        urlIsAllTime: false,
      }),
    ).toBe(true);
  });
});
