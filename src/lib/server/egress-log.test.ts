import { describe, expect, it } from "vitest";
import { approxJsonBytes } from "./egress-log";

describe("egress-log", () => {
  it("estimates UTF-8 JSON size", () => {
    expect(approxJsonBytes({ a: 1 })).toBeGreaterThan(0);
    expect(approxJsonBytes({ big: "x".repeat(1000) })).toBeGreaterThan(1000);
  });
});
