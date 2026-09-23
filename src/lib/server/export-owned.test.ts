import { describe, expect, it } from "vitest";
import {
  parseEnabledSectionKeys,
  requestedExportIds,
  selectOwnedExportRows,
} from "./export-owned";

describe("export-owned", () => {
  it("uses ids from the body and ignores forged row payloads", () => {
    const ids = requestedExportIds({
      ids: [1, 2],
      data: [{ id: 99, loanName: "forged" }],
    });
    expect(ids).toEqual([1, 2]);
    expect(
      selectOwnedExportRows([{ id: 1 }, { id: 2 }, { id: 3 }], ids),
    ).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("falls back to data[].id when ids is omitted", () => {
    expect(requestedExportIds({ data: [{ id: 4 }, { id: 5 }] })).toEqual([
      4, 5,
    ]);
  });

  it("parses section keys", () => {
    expect(parseEnabledSectionKeys({ enabledSectionKeys: ["a"] })).toEqual([
      "a",
    ]);
    expect(parseEnabledSectionKeys({ enabledSectionKeys: [1] })).toBeNull();
  });
});
