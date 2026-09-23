import { describe, expect, it } from "vitest";
import {
  isRateLimitedApiPath,
  nextRateLimitState,
  rateLimitKey,
} from "./rate-limit";

describe("rate-limit", () => {
  it("resets after the window", () => {
    const first = nextRateLimitState(null, 1000, 2, 60_000);
    expect(first).toMatchObject({ allowed: true, count: 1 });
    const second = nextRateLimitState(first, 2000, 2, 60_000);
    expect(second.allowed).toBe(true);
    const blocked = nextRateLimitState(second, 3000, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    const reset = nextRateLimitState(blocked, 1000 + 60_000, 2, 60_000);
    expect(reset.allowed).toBe(true);
    expect(reset.count).toBe(1);
  });

  it("keys high-cost routes", () => {
    expect(isRateLimitedApiPath("/api/sign/abc")).toBe(true);
    expect(isRateLimitedApiPath("/api/loans")).toBe(false);
    expect(rateLimitKey("/api/sign/abc", "1.2.3.4")).toBe(
      "/api/sign/abc:1.2.3.4",
    );
  });
});
