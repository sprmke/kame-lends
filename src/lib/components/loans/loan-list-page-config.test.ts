import { describe, expect, it } from "vitest";
import {
  LOAN_LIST_PAGE_VARIANTS,
  resolveLoanListPageScope,
  resolveLoanListPageVariant,
} from "./loan-list-page-config";

describe("LOAN_LIST_PAGE_VARIANTS bulk select", () => {
  it("enables checkboxes on every loans hub tab", () => {
    for (const scope of [
      "loans",
      "investments",
      "borrowed",
      "commissioned",
      "witnessed",
    ] as const) {
      expect(LOAN_LIST_PAGE_VARIANTS[scope].showBulkActions).toBe(true);
      expect(LOAN_LIST_PAGE_VARIANTS[scope].showAddToGroup).toBe(true);
    }
  });
});

describe("resolveLoanListPageVariant", () => {
  it("returns the matching variant for a page scope", () => {
    expect(resolveLoanListPageVariant("group").listInvalidate).toBe(
      "app:groups",
    );
    expect(resolveLoanListPageVariant("investments").listInvalidate).toBe(
      "app:loans",
    );
  });

  it("maps URL and list-query aliases", () => {
    expect(resolveLoanListPageScope("mine")).toBe("loans");
    expect(resolveLoanListPageScope("investing")).toBe("investments");
    expect(resolveLoanListPageScope("owned")).toBe("loans");
    expect(resolveLoanListPageVariant("mine")).toBe(
      LOAN_LIST_PAGE_VARIANTS.loans,
    );
    expect(resolveLoanListPageVariant("investing")).toBe(
      LOAN_LIST_PAGE_VARIANTS.investments,
    );
  });

  it("falls back to loans when scope is missing or unknown", () => {
    expect(resolveLoanListPageScope(undefined)).toBe("loans");
    expect(resolveLoanListPageScope("not-a-scope")).toBe("loans");
    expect(resolveLoanListPageVariant(undefined)).toBe(
      LOAN_LIST_PAGE_VARIANTS.loans,
    );
    expect(resolveLoanListPageVariant(null)).toBe(
      LOAN_LIST_PAGE_VARIANTS.loans,
    );
    expect(resolveLoanListPageVariant("not-a-scope")).toBe(
      LOAN_LIST_PAGE_VARIANTS.loans,
    );
    expect(resolveLoanListPageVariant(undefined).listInvalidate).toBe(
      "app:loans",
    );
  });
});
