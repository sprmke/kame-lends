import { describe, expect, it } from "vitest";
import {
  detectInterestDateExtensions,
  latestExtension,
} from "$lib/loans/interest-extensions";

describe("interest extension detection", () => {
  it("finds a period whose due date moved later", () => {
    const result = detectInterestDateExtensions(
      [{ id: 1, dueDateKey: "2026-06-30" }],
      [{ id: 1, dueDateKey: "2026-07-15" }],
    );
    expect(result).toEqual([
      {
        periodId: 1,
        previousDueDateKey: "2026-06-30",
        dueDateKey: "2026-07-15",
      },
    ]);
  });

  it("ignores earlier dates, new periods, and removals", () => {
    const result = detectInterestDateExtensions(
      [
        { id: 1, dueDateKey: "2026-06-30" },
        { id: 2, dueDateKey: "2026-07-31" },
      ],
      [
        { id: 1, dueDateKey: "2026-06-15" },
        { id: 3, dueDateKey: "2026-08-31" },
      ],
    );
    expect(result).toEqual([]);
  });

  it("returns the latest extension", () => {
    const latest = latestExtension([
      {
        periodId: 1,
        previousDueDateKey: "2026-06-30",
        dueDateKey: "2026-07-10",
      },
      {
        periodId: 2,
        previousDueDateKey: "2026-07-31",
        dueDateKey: "2026-08-15",
      },
    ]);
    expect(latest?.periodId).toBe(2);
  });
});
