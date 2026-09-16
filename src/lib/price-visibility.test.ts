import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("$lib/stores/price-visibility.svelte", () => ({
  priceVisibility: { pricesHidden: false },
}));

import { priceVisibility } from "$lib/stores/price-visibility.svelte";
import {
  formatSensitiveCount,
  formatSensitiveText,
  HIDDEN_CURRENCY_DISPLAY,
  HIDDEN_PERCENTAGE_DISPLAY,
} from "./price-visibility";
import { formatCurrency, formatDate, formatPercentage } from "./format";

describe("price visibility", () => {
  beforeEach(() => {
    priceVisibility.pricesHidden = false;
  });

  afterEach(() => {
    priceVisibility.pricesHidden = false;
  });

  it("masks currency and rates when hidden", () => {
    priceVisibility.pricesHidden = true;
    expect(formatCurrency(1234.5)).toBe(HIDDEN_CURRENCY_DISPLAY);
    expect(formatPercentage(12.5)).toBe(HIDDEN_PERCENTAGE_DISPLAY);
  });

  it("keeps names, dates, and counts visible when hidden", () => {
    priceVisibility.pricesHidden = true;
    expect(formatSensitiveText("Ana Reyes")).toBe("Ana Reyes");
    expect(formatSensitiveCount(3)).toBe("3");
    expect(formatDate("2024-01-15")).toMatch(/2024/);
  });

  it("shows currency and rates when visible", () => {
    priceVisibility.pricesHidden = false;
    expect(formatCurrency(100)).toContain("100");
    expect(formatPercentage(5)).toBe("5.00%");
  });
});
