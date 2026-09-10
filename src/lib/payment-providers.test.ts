import { describe, expect, it } from "vitest";
import {
  formatPaymentAccountNumberDisplay,
  validatePaymentAccountNumber,
  validatePaymentProvider,
} from "$lib/payment-providers";

describe("validatePaymentProvider", () => {
  it("requires a supported provider", () => {
    expect(validatePaymentProvider("")).toBe("Select a bank or e-wallet");
    expect(validatePaymentProvider("Random Bank")).toBe(
      "Select a supported bank or e-wallet",
    );
    expect(validatePaymentProvider("GCash")).toBeNull();
    expect(validatePaymentProvider("BDO")).toBeNull();
  });
});

describe("validatePaymentAccountNumber", () => {
  it("validates e-wallet numbers", () => {
    expect(validatePaymentAccountNumber("GCash", "09171234567")).toBeNull();
    expect(validatePaymentAccountNumber("GCash", "9171234567")).toBeNull();
    expect(validatePaymentAccountNumber("GCash", "08171234567")).toBe(
      "Account number should start with 09",
    );
    expect(validatePaymentAccountNumber("GCash", "09123")).toBe(
      "Account number must be 10–11 digits",
    );
  });

  it("validates bank account numbers", () => {
    expect(validatePaymentAccountNumber("BDO", "1234567890")).toBeNull();
    expect(validatePaymentAccountNumber("BDO", "123")).toBe(
      "Account number must be 8–24 characters",
    );
  });
});

describe("formatPaymentAccountNumberDisplay", () => {
  it("formats mobile wallet numbers", () => {
    expect(formatPaymentAccountNumberDisplay("GCash", "09171234567")).toBe(
      "0917 123 4567",
    );
  });
});
