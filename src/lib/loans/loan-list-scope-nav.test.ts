import { describe, expect, it } from "vitest";
import { resolveLoanScopeTab } from "$lib/loans/loan-list-scope-nav";

describe("resolveLoanScopeTab", () => {
  it("defaults to mine", () => {
    expect(resolveLoanScopeTab(null).param).toBe("mine");
    expect(resolveLoanScopeTab("").listScope).toBe("owned");
  });

  it("maps investing param to investments scope", () => {
    const tab = resolveLoanScopeTab("investing");
    expect(tab.listScope).toBe("investments");
    expect(tab.pageScope).toBe("investments");
  });

  it("maps commissioned param to commissioned scope", () => {
    const tab = resolveLoanScopeTab("commissioned");
    expect(tab.listScope).toBe("commissioned");
    expect(tab.pageScope).toBe("commissioned");
  });
});
