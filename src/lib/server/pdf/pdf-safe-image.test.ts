import { describe, expect, it } from "vitest";
import { pdfSafeImageSrc, stripContractEmbeddedImages } from "./pdf-safe-image";
import type { LoanContractData } from "$lib/loan-contract-data";
import { buildDefaultContractCustomizationFromLoan } from "$lib/loan-contract-customization";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const WEBP =
  "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";

describe("pdfSafeImageSrc", () => {
  it("keeps jpeg and png data URLs", () => {
    expect(pdfSafeImageSrc(PNG)).toBe(PNG);
    expect(pdfSafeImageSrc(` ${JPEG} `)).toBe(JPEG);
  });

  it("drops oversized data URLs", () => {
    const huge = `data:image/png;base64,${"A".repeat(700_000)}`;
    expect(pdfSafeImageSrc(huge)).toBeNull();
  });

  it("drops webp, empty, storage refs, and non-data URLs", () => {
    expect(pdfSafeImageSrc(WEBP)).toBeNull();
    expect(pdfSafeImageSrc("")).toBeNull();
    expect(pdfSafeImageSrc("https://example.com/id.png")).toBeNull();
    expect(pdfSafeImageSrc("storage:uploads/user/signature.png")).toBeNull();
    expect(pdfSafeImageSrc(null)).toBeNull();
  });
});

describe("stripContractEmbeddedImages", () => {
  it("clears party image fields so a retry can render without Image nodes", () => {
    const data: LoanContractData = {
      contractNumber: "PT-1-2026",
      agreementDate: new Date("2026-01-01"),
      borrowerName: "Borrower",
      borrowerAddress: null,
      borrowerContact: null,
      borrowerEmail: null,
      borrowerValidIdUrl: PNG,
      borrowerESignatureUrl: PNG,
      loanTitleLabel: "Test",
      loanType: "Agent",
      contractTitle: "Loan Agreement",
      collateralDescription: "None",
      freeLotSqm: null,
      dateBorrowed: new Date("2026-01-01"),
      dueDate: new Date("2026-01-08"),
      principalAmount: 1000,
      totalInterest: 50,
      totalAmountDue: 1050,
      lenders: [
        {
          name: "Lender",
          contactNumber: null,
          email: "lender@example.com",
          address: null,
          validIdUrl: JPEG,
          eSignatureUrl: PNG,
          principalAmount: 1000,
          interestDescription: "5%",
        },
      ],
      notes: null,
    };
    const customization = buildDefaultContractCustomizationFromLoan(data);
    customization.witness1ValidIdUrl = JPEG;
    customization.witness1ESignatureUrl = PNG;

    const stripped = stripContractEmbeddedImages(data, customization);

    expect(stripped.data.borrowerValidIdUrl).toBeNull();
    expect(stripped.data.borrowerESignatureUrl).toBeNull();
    expect(stripped.data.lenders[0]?.validIdUrl).toBeNull();
    expect(stripped.data.lenders[0]?.eSignatureUrl).toBeNull();
    expect(stripped.customization?.witness1ValidIdUrl).toBe("");
    expect(stripped.customization?.witness1ESignatureUrl).toBe("");
  });
});
