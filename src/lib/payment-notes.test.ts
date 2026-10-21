import { describe, expect, it } from "vitest";
import {
  loanPaymentNotesError,
  optionalPaymentNotes,
  parseOptionalPaymentNotes,
  PAYMENT_NOTES_MAX_LENGTH,
} from "./payment-notes";

describe("parseOptionalPaymentNotes", () => {
  it("treats empty values as no notes", () => {
    expect(parseOptionalPaymentNotes(undefined)).toEqual({ notes: null });
    expect(parseOptionalPaymentNotes(null)).toEqual({ notes: null });
    expect(parseOptionalPaymentNotes("   ")).toEqual({ notes: null });
  });

  it("keeps trimmed notes", () => {
    expect(parseOptionalPaymentNotes("  Wire ref  ")).toEqual({
      notes: "Wire ref",
    });
  });

  it("rejects non-text and over-long notes", () => {
    expect(parseOptionalPaymentNotes(12)).toEqual({
      error: "Notes must be text.",
    });
    expect(
      parseOptionalPaymentNotes("a".repeat(PAYMENT_NOTES_MAX_LENGTH + 1)),
    ).toEqual({
      error: `Notes must be ${PAYMENT_NOTES_MAX_LENGTH} characters or fewer.`,
    });
  });
});

describe("loanPaymentNotesError", () => {
  it("checks disbursements and received payments", () => {
    expect(
      loanPaymentNotesError({
        investorData: [{ notes: "ok" }],
        receivedPaymentsByInvestor: [{ receivedPayments: [{ notes: 1 }] }],
      }),
    ).toBe("Notes must be text.");
    expect(optionalPaymentNotes("  kept  ")).toBe("kept");
  });
});
