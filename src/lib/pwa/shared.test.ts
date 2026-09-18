import { describe, expect, it, vi } from "vitest";
import {
  installDismissed,
  isNeverCached,
  isOfflineApiRead,
  normalizeDataCacheKey,
  recordInstallDismissal,
} from "$lib/pwa/shared";

describe("normalizeDataCacheKey", () => {
  it("strips x-sveltekit-invalidated", () => {
    expect(
      normalizeDataCacheKey(
        "/loans/__data.json?x-sveltekit-invalidated=001&scope=owned",
      ),
    ).toBe("/loans/__data.json?scope=owned");
  });
});

describe("cache policy helpers", () => {
  it("blocks auth and mutating API paths", () => {
    expect(isNeverCached("/auth/signin")).toBe(true);
    expect(isNeverCached("/api/storage/upload")).toBe(true);
    expect(isNeverCached("/dashboard")).toBe(false);
  });

  it("allows only offline read API roots", () => {
    expect(isOfflineApiRead("/api/loans")).toBe(true);
    expect(isOfflineApiRead("/api/loans/1")).toBe(true);
    expect(isOfflineApiRead("/api/transactions")).toBe(false);
  });
});

describe("install dismissal", () => {
  it("respects the cooldown window", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });

    const now = Date.UTC(2026, 0, 1);
    recordInstallDismissal(now);
    expect(installDismissed(now + 1_000)).toBe(true);
    expect(installDismissed(now + 31 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});
