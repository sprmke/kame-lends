import { afterEach, describe, expect, it } from "vitest";
import {
  invalidateLoanData,
  invalidateInvestorData,
} from "./cache-invalidation";
import {
  memoryCacheClear,
  memoryCacheGet,
  memoryCacheSet,
} from "./memory-cache";

describe("cache-invalidation", () => {
  afterEach(() => {
    memoryCacheClear();
  });

  it("clears loans and dashboard when loans change", () => {
    memoryCacheSet("loans:u1", ["a"]);
    memoryCacheSet("dashboard:u1", { n: 1 });
    memoryCacheSet("investors:u1:simple", ["i"]);
    invalidateLoanData();
    expect(memoryCacheGet("loans:u1")).toBeUndefined();
    expect(memoryCacheGet("dashboard:u1")).toBeUndefined();
    expect(memoryCacheGet("investors:u1:simple")).toEqual(["i"]);
  });

  it("clears related lists when investors change", () => {
    memoryCacheSet("investors:u1:full", ["i"]);
    memoryCacheSet("loans:u1", ["a"]);
    memoryCacheSet("debts:u1:all", ["d"]);
    invalidateInvestorData();
    expect(memoryCacheGet("investors:u1:full")).toBeUndefined();
    expect(memoryCacheGet("loans:u1")).toBeUndefined();
    expect(memoryCacheGet("debts:u1:all")).toBeUndefined();
  });
});
