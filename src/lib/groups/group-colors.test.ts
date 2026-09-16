import { describe, expect, it } from "vitest";
import {
  GROUP_COLOR_KEYS,
  nextGroupColor,
  resolveGroupColor,
} from "./group-colors";

describe("group-colors", () => {
  it("resolves every palette key", () => {
    for (const key of GROUP_COLOR_KEYS) {
      const resolved = resolveGroupColor(key);
      expect(resolved.key).toBe(key);
      expect(resolved.dot).toBeTruthy();
      expect(resolved.bg).toBeTruthy();
      expect(resolved.text).toBeTruthy();
      expect(resolved.ring).toBeTruthy();
    }
  });

  it("falls back to orange for unknown keys", () => {
    expect(resolveGroupColor("neon").key).toBe("orange");
    expect(resolveGroupColor(undefined).key).toBe("orange");
    expect(resolveGroupColor(null).key).toBe("orange");
  });

  it("suggests an unused color", () => {
    expect(nextGroupColor([])).toBe("orange");
    expect(nextGroupColor(["orange", "amber"])).toBe("emerald");
    expect(nextGroupColor(GROUP_COLOR_KEYS)).toBe("orange");
  });
});
