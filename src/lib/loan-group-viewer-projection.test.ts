import { describe, expect, it } from "vitest";
import {
  collectForbiddenHits,
  projectLoanForGroupViewer,
} from "./loan-group-viewer-projection";

describe("projectLoanForGroupViewer", () => {
  it("removes PII and sensitive artifacts while keeping amounts", () => {
    const entity = {
      id: 1,
      principalAmount: "100000",
      status: "Fully Funded",
      googleCalendarEventIds: ["x"],
      signingInvitations: [{ id: 1 }],
      loanContract: { id: 1 },
      paymentMethods: [{ id: 1 }],
      borrower: {
        name: "Juan",
        email: "j@x.com",
        contactNumber: "09",
        address: "Manila",
        validIdUrl: "http://id",
        eSignatureUrl: "http://sig",
        notes: "secret",
      },
      loanInvestors: [
        {
          amount: "50000",
          receiptImageUrl: "http://r",
          receipts: [{ url: "http://r" }],
          receiptExtractedData: { amount: 1 },
          investor: {
            name: "Maria",
            email: "m@x.com",
            contactNumber: "08",
          },
          receivedPayments: [
            {
              amount: "1000",
              receipts: [{ url: "http://p" }],
              receiptImageUrl: "http://p",
            },
          ],
        },
      ],
      loanWitnesses: [
        {
          witness: { name: "Ana", email: "a@x.com", validIdUrl: "http://w" },
        },
      ],
    };

    const projected = projectLoanForGroupViewer(entity);
    expect(projected.principalAmount).toBe("100000");
    expect(projected.borrower?.name).toBe("Juan");
    expect(projected.borrower?.email).toBeNull();
    expect(projected.signingInvitations).toBeUndefined();
    expect(projected.loanContract).toBeUndefined();
    expect(collectForbiddenHits(projected)).toEqual([]);
    expect(projected.loanInvestors?.[0]?.investor?.name).toBe("Maria");
    expect(projected.loanInvestors?.[0]?.receivedPayments?.[0]?.amount).toBe(
      "1000",
    );
  });
});
