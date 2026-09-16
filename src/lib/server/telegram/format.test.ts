import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatTelegramDateKey,
  formatTelegramMoney,
} from "./format";
import { normalizeTelegramChatId } from "./normalize";

describe("normalizeTelegramChatId", () => {
  it("trims and keeps numeric string ids", () => {
    expect(normalizeTelegramChatId("  -100123  ")).toBe("-100123");
  });

  it("replaces unicode minus U+2212 with ASCII hyphen", () => {
    expect(normalizeTelegramChatId(`−100456789`)).toBe("-100456789");
  });

  it("returns null for empty input", () => {
    expect(normalizeTelegramChatId("")).toBeNull();
    expect(normalizeTelegramChatId(null)).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`a & b <c> "d"`)).toBe('a &amp; b &lt;c&gt; "d"');
  });
});

describe("formatTelegramMoney", () => {
  it("formats PHP when amounts are included", () => {
    expect(formatTelegramMoney(1000, true)).toBe("₱1,000");
  });

  it("hides amounts when disabled", () => {
    expect(formatTelegramMoney(1000, false)).toBe("—");
  });
});

describe("formatTelegramDateKey", () => {
  it("formats a calendar date key", () => {
    expect(formatTelegramDateKey("2026-09-14")).toContain("Sep");
    expect(formatTelegramDateKey("2026-09-14")).toContain("14");
  });
});
