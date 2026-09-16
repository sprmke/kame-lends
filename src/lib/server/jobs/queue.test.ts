import { describe, expect, it } from "vitest";
import { jobBackoffMs } from "./backoff";

describe("jobBackoffMs", () => {
  it("grows exponentially and stays finite", () => {
    expect(jobBackoffMs(1)).toBe(30_000);
    expect(jobBackoffMs(2)).toBe(60_000);
    expect(jobBackoffMs(3)).toBe(120_000);
    expect(jobBackoffMs(6)).toBe(30_000 * 2 ** 5);
    expect(jobBackoffMs(10)).toBe(30_000 * 2 ** 5);
  });
});
