import { describe, expect, it } from "vitest";
import { DEFAULT_NEON_TRANSFER_ALERT_BYTES, formatBytes } from "./neon-usage";

describe("neon-usage", () => {
  it("formats bytes for alerts", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(10 * 1024 * 1024 * 1024)).toContain("GB");
  });

  it("defaults alert threshold to 10 GB", () => {
    expect(DEFAULT_NEON_TRANSFER_ALERT_BYTES).toBe(10 * 1024 * 1024 * 1024);
  });
});
