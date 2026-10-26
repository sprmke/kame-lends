import { describe, expect, it } from "vitest";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import { applyAutoAttachFlagsToCustomization } from "./auto-attach-customization";

function blank(): ContractCustomization {
  return {
    contractTitle: "",
    collateralSummary: "",
    securityClause: "",
    disputeVenue: "",
    witness1Id: null,
    witness1Name: "",
    witness1Email: "",
    witness1Address: "",
    witness1ValidIdUrl: "",
    witness1ESignatureUrl: "",
    witness1SignatureIncluded: false,
    includeSecondWitness: false,
    witness2Id: null,
    witness2Name: "",
    witness2Email: "",
    witness2Address: "",
    witness2ValidIdUrl: "",
    witness2ESignatureUrl: "",
    witness2SignatureIncluded: false,
    includeWitnesses: false,
    includeBorrowerSignature: false,
    lenderSignaturesIncluded: {},
    borrowerDateSigned: "",
    lenderDateSigned: {},
    witness1DateSigned: "",
    witness2DateSigned: "",
    additionalTerms: "",
  };
}

describe("applyAutoAttachFlagsToCustomization", () => {
  it("sets borrower and lender include flags", () => {
    const next = applyAutoAttachFlagsToCustomization(
      blank(),
      ["borrower", "lender"],
      {
        lenderEmail: "lender@example.com",
        signedDateIso: "2026-10-01",
      },
    );
    expect(next.includeBorrowerSignature).toBe(true);
    expect(next.lenderSignaturesIncluded["lender@example.com"]).toBe(true);
    expect(next.borrowerDateSigned).toBe("2026-10-01");
  });

  it("does not clear existing signed dates", () => {
    const base = blank();
    base.borrowerDateSigned = "2026-09-01";
    const next = applyAutoAttachFlagsToCustomization(base, ["borrower"], {
      signedDateIso: "2026-10-01",
    });
    expect(next.borrowerDateSigned).toBe("2026-09-01");
  });
});
