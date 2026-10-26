import { describe, expect, it } from "vitest";
import {
  firstLoanFormFocusTarget,
  loanFormValidationSummary,
  type LoanFormFocusInvestor,
} from "./loan-form-focus";

const investors: LoanFormFocusInvestor[] = [
  {
    investorId: 4,
    transactionIds: ["tx-1", "tx-2"],
    receivedPaymentIds: ["rp-1"],
  },
];

describe("firstLoanFormFocusTarget", () => {
  it("prefers loan details over a missing receipt", () => {
    expect(
      firstLoanFormFocusTarget(
        {
          loanName: "Loan name is required",
          "receipt-tx-tx-1": "Upload a receipt.",
        },
        investors,
      ),
    ).toEqual({ domId: "field-loan-name" });
  });

  it("opens the principal tab on the first disbursement missing a receipt", () => {
    expect(
      firstLoanFormFocusTarget(
        {
          investors: "Upload a receipt for each principal disbursement.",
          "receipt-tx-tx-2": "Upload a receipt.",
          "receipt-rp-rp-1": "Upload a receipt.",
        },
        investors,
      ),
    ).toEqual({
      domId: "receipt-tx-tx-2",
      investorId: 4,
      tab: "principal",
    });
  });

  it("opens the received tab when only a payment receipt is missing", () => {
    expect(
      firstLoanFormFocusTarget(
        {
          investors: "Upload a receipt for each received payment.",
          "receipt-rp-rp-1": "Upload a receipt.",
        },
        investors,
      ),
    ).toEqual({
      domId: "receipt-rp-rp-1",
      investorId: 4,
      tab: "received",
    });
  });

  it("falls back to the investors section", () => {
    expect(
      firstLoanFormFocusTarget(
        { investors: "At least one investor is required" },
        [],
      ),
    ).toEqual({ domId: "investors-section" });
  });
});

describe("loanFormValidationSummary", () => {
  it("uses the receipt summary when the field error is also set", () => {
    expect(
      loanFormValidationSummary({
        investors: "Upload a receipt for each principal disbursement.",
        "receipt-tx-tx-1": "Upload a receipt.",
      }),
    ).toBe("Upload a receipt for each principal disbursement.");
  });
});
