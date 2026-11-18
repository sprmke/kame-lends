import { describe, expect, it } from "vitest";
import {
  leanLoanInvestorColumns,
  leanLoanInvestorNestUnderLoan,
  leanReceivedPaymentColumns,
  receivedPaymentColumnsWithReceipts,
} from "./payment-select";

describe("payment-select", () => {
  it("omits receipt blobs from lean payment columns", () => {
    expect(leanReceivedPaymentColumns).not.toHaveProperty("receiptImageUrl");
    expect(leanReceivedPaymentColumns).not.toHaveProperty("receipts");
    expect(leanReceivedPaymentColumns).not.toHaveProperty(
      "receiptExtractedData",
    );
    expect(leanReceivedPaymentColumns).toHaveProperty("amount");
  });

  it("omits receipt blobs from lean loan investor columns", () => {
    expect(leanLoanInvestorColumns).not.toHaveProperty("receiptImageUrl");
    expect(leanLoanInvestorColumns).not.toHaveProperty("receipts");
    expect(leanLoanInvestorColumns).toHaveProperty("amount");
  });

  it("includes receipt blobs only on the detail set", () => {
    expect(receivedPaymentColumnsWithReceipts).toHaveProperty(
      "receiptImageUrl",
    );
    expect(receivedPaymentColumnsWithReceipts).toHaveProperty("receipts");
  });

  it("nests lean payments under loans for backups", () => {
    expect(leanLoanInvestorNestUnderLoan.with.receivedPayments.columns).toEqual(
      leanReceivedPaymentColumns,
    );
  });
});
