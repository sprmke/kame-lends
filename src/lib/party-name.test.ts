import { describe, expect, it } from "vitest";
import { normalizePartyName, uniquePartiesByName } from "./party-name";

describe("uniquePartiesByName", () => {
  it("keeps the oldest row when names differ only by case or spacing", () => {
    const rows = uniquePartiesByName([
      { id: 5, name: "Precious  Natividad" },
      { id: 1, name: "precious natividad" },
      { id: 2, name: "Aileen Tongol" },
    ]);
    expect(rows.map((row) => row.id)).toEqual([1, 2]);
    expect(normalizePartyName("  Precious   Natividad ")).toBe(
      "precious natividad",
    );
  });

  it("leaves different names and blank names in place", () => {
    const rows = uniquePartiesByName([
      { id: 3, name: "  " },
      { id: 4, name: "" },
      { id: 8, name: "Ana Lim" },
      { id: 9, name: "Ana  Cruz" },
    ]);
    expect(rows.map((row) => row.id)).toEqual([3, 4, 8, 9]);
  });
});
