import { describe, expect, it } from "vitest";
import {
  MAX_PAYMENT_METHODS_PER_USER,
  parsePaymentMethodId,
  parsePaymentMethodInput,
} from "$lib/payment-methods";

describe("payment-methods parsing", () => {
  it("exposes a positive method limit", () => {
    expect(MAX_PAYMENT_METHODS_PER_USER).toBeGreaterThan(0);
  });

  it("parses valid integer ids", () => {
    expect(parsePaymentMethodId("1")).toBe(1);
    expect(parsePaymentMethodId("42")).toBe(42);
  });

  it("rejects invalid ids", () => {
    expect(parsePaymentMethodId(undefined)).toBeNull();
    expect(parsePaymentMethodId("")).toBeNull();
    expect(parsePaymentMethodId("1.5")).toBeNull();
    expect(parsePaymentMethodId("0")).toBeNull();
    expect(parsePaymentMethodId("-3")).toBeNull();
    expect(parsePaymentMethodId("abc")).toBeNull();
  });

  it("requires bank name and account number", () => {
    expect(parsePaymentMethodInput({})).toEqual({
      error: "Bank name is required",
    });
    expect(parsePaymentMethodInput({ bankName: "  " })).toEqual({
      error: "Bank name is required",
    });
    expect(parsePaymentMethodInput({ bankName: "BDO" })).toEqual({
      error: "Account number is required",
    });
  });

  it("trims and accepts valid fields without QR", () => {
    expect(
      parsePaymentMethodInput({
        bankName: "  BDO  ",
        accountNumber: " 1234567890 ",
      }),
    ).toEqual({
      bankName: "BDO",
      accountNumber: "1234567890",
      qrCodeUrl: null,
    });
  });

  it("rejects oversized fields", () => {
    expect(
      parsePaymentMethodInput({
        bankName: "x".repeat(121),
        accountNumber: "1",
      }),
    ).toEqual({ error: "Bank name is too long" });
    expect(
      parsePaymentMethodInput({
        bankName: "BDO",
        accountNumber: "9".repeat(65),
      }),
    ).toEqual({ error: "Account number is too long" });
  });

  it("rejects invalid QR payloads", () => {
    expect(
      parsePaymentMethodInput({
        bankName: "BDO",
        accountNumber: "1",
        qrCodeUrl: "https://example.com/qr.png",
      }),
    ).toEqual({ error: "QR code must be a JPEG, PNG, or WebP image" });
  });

  it("accepts a valid data-url QR image", () => {
    const qr = "data:image/png;base64,aaaa";
    expect(
      parsePaymentMethodInput({
        bankName: "GCash",
        accountNumber: "09171234567",
        qrCodeUrl: qr,
      }),
    ).toEqual({
      bankName: "GCash",
      accountNumber: "09171234567",
      qrCodeUrl: qr,
    });
  });
});
