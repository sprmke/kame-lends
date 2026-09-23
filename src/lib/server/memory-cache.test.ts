import { afterEach, describe, expect, it } from "vitest";
import {
  CACHE_MAX_ENTRIES,
  memoryCacheClear,
  memoryCacheGet,
  memoryCacheInvalidatePrefix,
  memoryCacheSet,
  remember,
} from "./memory-cache";

describe("memory-cache", () => {
  afterEach(() => {
    memoryCacheClear();
  });

  it("returns cached values until TTL expires", () => {
    memoryCacheSet("loans:u1", [1], 60_000);
    expect(memoryCacheGet<number[]>("loans:u1")).toEqual([1]);
  });

  it("drops keys by prefix", () => {
    memoryCacheSet("loans:u1", 1);
    memoryCacheSet("dashboard:u1", 2);
    memoryCacheInvalidatePrefix("loans:");
    expect(memoryCacheGet("loans:u1")).toBeUndefined();
    expect(memoryCacheGet("dashboard:u1")).toBe(2);
  });

  it("does not store a fetch that finished after invalidation", async () => {
    let resolveFetch: (value: string) => void = () => {};
    const fetch = new Promise<string>((resolve) => {
      resolveFetch = resolve;
    });

    const first = remember("loans:u1", () => fetch);
    memoryCacheInvalidatePrefix("loans:");
    resolveFetch("stale");
    await expect(first).resolves.toBe("stale");
    expect(memoryCacheGet("loans:u1")).toBeUndefined();
  });

  it("evicts the oldest entry when full", () => {
    for (let i = 0; i < CACHE_MAX_ENTRIES; i += 1) {
      memoryCacheSet(`k:${i}`, i, 60_000);
    }
    memoryCacheSet("k:new", "ok", 60_000);
    expect(memoryCacheGet("k:0")).toBeUndefined();
    expect(memoryCacheGet("k:new")).toBe("ok");
  });
});
