import { describe, expect, it } from "vitest";
import {
  applyOverdueLoansListFilters,
  dueDateRangeEnclosingLoans,
  overdueLoansListHref,
} from "./loan-list-overdue-filter";

describe("loan-list-overdue-filter", () => {
  it("computes enclosing due-date range", () => {
    expect(
      dueDateRangeEnclosingLoans([
        { dueDate: "2026-03-15" },
        { dueDate: "2026-01-02" },
        { dueDate: "2026-02-10" },
      ]),
    ).toEqual({ from: "2026-01-02", to: "2026-03-15" });
  });

  it("applies overdue status and date range on a URL", () => {
    const url = new URL(
      "https://example.com/groups/1?tab=overview&from=2026-10-01&to=2026-10-31",
    );
    applyOverdueLoansListFilters(url, [{ dueDate: "2026-08-05" }], {
      tab: "loans",
    });
    expect(url.search).toBe(
      "?tab=loans&status=Overdue&from=2026-08-05&to=2026-08-05",
    );
  });

  it("builds main loans list href with table view", () => {
    expect(
      overdueLoansListHref("/loans", [{ dueDate: "2026-07-01" }], {
        view: "table",
      }),
    ).toBe("/loans?view=table&status=Overdue&from=2026-07-01&to=2026-07-01");
  });
});
