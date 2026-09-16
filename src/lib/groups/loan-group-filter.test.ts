import { describe, expect, it } from "vitest";
import {
  buildGroupFilterOptions,
  filterLoansByGroup,
  parseGroupSelection,
  groupSelectionToParam,
} from "./loan-group-filter";
import type { LoanWithInvestors } from "$lib/types";

function loan(id: number, groupIds: number[]): LoanWithInvestors {
  return {
    id,
    groupIds,
    groupLoans: groupIds.map((groupId) => ({ groupId, source: "manual" })),
  } as LoanWithInvestors;
}

describe("loan-group-filter", () => {
  const loans = [loan(1, [10]), loan(2, []), loan(3, [10, 20])];

  it("parses URL selection", () => {
    expect(parseGroupSelection(null)).toBe("all");
    expect(parseGroupSelection("ungrouped")).toBe("ungrouped");
    expect(parseGroupSelection("12")).toBe(12);
  });

  it("keeps group scope when clearing filters (param helpers)", () => {
    expect(groupSelectionToParam(10)).toBe("10");
    expect(groupSelectionToParam("all")).toBeNull();
  });

  it("filters by group, ungrouped, and all", () => {
    expect(filterLoansByGroup(loans, "all")).toHaveLength(3);
    expect(filterLoansByGroup(loans, "ungrouped").map((l) => l.id)).toEqual([
      2,
    ]);
    expect(filterLoansByGroup(loans, 10).map((l) => l.id)).toEqual([1, 3]);
  });

  it("builds group filter dropdown options", () => {
    expect(
      buildGroupFilterOptions({
        groups: [{ id: 10, name: "Alpha", loanCountOnPage: 2 }],
        showUngrouped: true,
        ungroupedCount: 1,
      }),
    ).toEqual([
      { value: "all", label: "All Groups" },
      { value: "10", label: "Alpha (2)" },
      { value: "ungrouped", label: "Ungrouped (1)" },
    ]);
  });
});
