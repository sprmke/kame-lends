import { describe, expect, it } from "vitest";
import {
  addC,
  centavosToPesos,
  clampC,
  formatPHP,
  fromCentavos,
  maxC,
  minC,
  mulC,
  mulRate,
  rateOf,
  roundHalfUp,
  subC,
  toCentavos,
} from "./centavos";

describe("centavos", () => {
  it("parses decimal strings exactly", () => {
    expect(toCentavos("100000")).toBe(10_000_000);
    expect(toCentavos("100000.5")).toBe(10_000_050);
    expect(toCentavos("0.01")).toBe(1);
    expect(toCentavos("33333.33")).toBe(3_333_333);
    expect(toCentavos("")).toBe(0);
    expect(toCentavos(null)).toBe(0);
  });

  it("rounds the third decimal half-up", () => {
    expect(toCentavos("1.005")).toBe(101);
    expect(toCentavos("1.004")).toBe(100);
    expect(toCentavos("0.015")).toBe(2);
  });

  it("round-trips to a two-decimal string", () => {
    expect(fromCentavos(10_000_000)).toBe("100000.00");
    expect(fromCentavos(1)).toBe("0.01");
    expect(fromCentavos(-5)).toBe("-0.05");
  });

  it("multiplies a rate without float drift", () => {
    // 33,333.33 × 3.33% = 1,109.999889 → 1,110.00
    expect(mulRate(3_333_333, "3.33")).toBe(111_000);
    expect(mulRate(10_000_000, "3")).toBe(300_000);
  });

  it("adds integer centavos", () => {
    expect(addC(1, 2, 3)).toBe(6);
    expect(addC()).toBe(0);
  });

  it("formats pesos and never prints NaN", () => {
    expect(formatPHP(123_456)).toContain("1,234.56");
    expect(formatPHP(Number.NaN)).toContain("0.00");
  });
});

describe("centavos helpers", () => {
  it("subtracts, multiplies, and clamps", () => {
    expect(subC(500, 200)).toBe(300);
    expect(mulC(1_000, 1.5)).toBe(1_500);
    expect(minC(10, 20)).toBe(10);
    expect(maxC(10, 20)).toBe(20);
    expect(clampC(150, 0, 100)).toBe(100);
    expect(clampC(-5, 0, 100)).toBe(0);
  });

  it("computes a rate share", () => {
    expect(rateOf(3_000, 10_000)).toBe(30);
    expect(rateOf(1, 0)).toBe(0);
  });

  it("rounds fractional centavos half-up", () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(0.49)).toBe(0);
    expect(roundHalfUp(-0.5)).toBe(-1);
  });

  it("guards non-finite values", () => {
    expect(toCentavos(Number.POSITIVE_INFINITY)).toBe(0);
    expect(toCentavos("abc")).toBe(0);
    expect(centavosToPesos(Number.NaN)).toBe(0);
  });
});
