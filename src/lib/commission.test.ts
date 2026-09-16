import { describe, expect, it } from "vitest";
import {
  isCommissionConfigured,
  normalizeCommissionType,
  parseCommissionValue,
} from "./commission";

describe("commission helpers", () => {
  it("normalizes missing commission type to rate", () => {
    expect(normalizeCommissionType(undefined)).toBe("rate");
    expect(normalizeCommissionType("rate")).toBe("rate");
    expect(normalizeCommissionType("fixed")).toBe("fixed");
  });

  it("parses invalid commission values as zero", () => {
    expect(parseCommissionValue(undefined)).toBe(0);
    expect(parseCommissionValue("")).toBe(0);
    expect(parseCommissionValue("12.5")).toBe(12.5);
  });

  it("treats zero or invalid values as not configured", () => {
    expect(isCommissionConfigured("rate", "0")).toBe(false);
    expect(isCommissionConfigured(undefined, undefined)).toBe(false);
    expect(isCommissionConfigured("fixed", "500")).toBe(true);
    expect(isCommissionConfigured("rate", "10")).toBe(true);
  });
});
