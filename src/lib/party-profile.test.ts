import { describe, expect, it } from "vitest";
import { parsePartyEntityType } from "./party-profile";

describe("parsePartyEntityType", () => {
  it("accepts valid entity types", () => {
    expect(parsePartyEntityType("investor")).toBe("investor");
    expect(parsePartyEntityType("borrower")).toBe("borrower");
    expect(parsePartyEntityType("witness")).toBe("witness");
  });

  it("rejects invalid values", () => {
    expect(parsePartyEntityType("admin")).toBeNull();
    expect(parsePartyEntityType(undefined)).toBeNull();
  });
});
