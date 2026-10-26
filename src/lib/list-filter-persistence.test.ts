import { describe, expect, it } from "vitest";
import {
  applyListFilterPatch,
  compactListFilterValues,
  listFilterValuesEqual,
  mergeListFilterSources,
  parseRememberedListFilters,
  readUrlListFilters,
} from "./list-filter-persistence";
import { loanListFilterValuesFromUrl } from "./loan-list-filter-params";

describe("list-filter-persistence", () => {
  it("parses remembered JSON", () => {
    expect(
      parseRememberedListFilters(
        JSON.stringify({ q: "abc", status: ["Overdue"] }),
      ),
    ).toEqual({ q: "abc", status: ["Overdue"] });
    expect(parseRememberedListFilters("{")).toBeNull();
    expect(parseRememberedListFilters("not-json")).toBeNull();
  });

  it("reads multi-value URL params", () => {
    const sp = new URLSearchParams("status=Overdue&status=Completed&q=test");
    expect(readUrlListFilters(sp, ["q", "status", "type"])).toEqual({
      q: "test",
      status: ["Overdue", "Completed"],
    });
  });

  it("merges URL over remembered", () => {
    const merged = mergeListFilterSources(
      { q: "url" },
      { q: "saved", status: ["Overdue"] },
      ["q", "status", "type"],
    );
    expect(merged).toEqual({ q: "url", status: ["Overdue"] });
  });

  it("applies patch to URL", () => {
    const url = new URL("https://example.com/loans?from=2026-01-01&status=Old");
    applyListFilterPatch(url, { q: "x", status: ["Overdue"], type: [] }, [
      "q",
      "status",
      "type",
    ]);
    expect(url.search).toBe("?from=2026-01-01&q=x&status=Overdue");
  });

  it("compacts empty values", () => {
    expect(
      compactListFilterValues({ q: "", status: [], type: "Lot Title" }),
    ).toEqual({ type: "Lot Title" });
  });

  it("fills missing loan list URL keys with empty defaults", () => {
    const full = loanListFilterValuesFromUrl({
      status: ["Completed", "Fully Funded"],
      view: "table",
    });
    expect(full.status).toEqual(["Completed", "Fully Funded"]);
    expect(full.view).toBe("table");
    expect(full.q).toBe("");
    expect(full.type).toEqual([]);
  });

  it("compares filter values", () => {
    expect(
      listFilterValuesEqual({ status: ["b", "a"] }, { status: ["a", "b"] }, [
        "status",
      ]),
    ).toBe(true);
    expect(listFilterValuesEqual({ q: "a" }, { q: "b" }, ["q"])).toBe(false);
  });
});
