import { describe, expect, it } from "vitest";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import {
  applyDefaultWitnesses,
  uniqueDefaultWitnesses,
  type DefaultWitnessProfile,
} from "./default-witnesses";

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

function witness(
  id: number,
  overrides: Partial<DefaultWitnessProfile> = {},
): DefaultWitnessProfile {
  return {
    id,
    name: `Witness ${id}`,
    email: `${id}@example.com`,
    address: null,
    validIdUrl: null,
    eSignatureUrl: `sig-${id}`,
    autoSign: false,
    ...overrides,
  };
}

describe("uniqueDefaultWitnesses", () => {
  it("keeps the first witness and turns auto-sign on if any group did", () => {
    const unique = uniqueDefaultWitnesses([
      witness(1, { autoSign: false }),
      witness(2),
      witness(1, { autoSign: true, name: "Later" }),
    ]);
    expect(unique.map((row) => row.id)).toEqual([1, 2]);
    expect(unique[0]?.autoSign).toBe(true);
    expect(unique[0]?.name).toBe("Witness 1");
  });
});

describe("applyDefaultWitnesses", () => {
  it("fills empty slots and checks include witnesses", () => {
    const next = applyDefaultWitnesses(blank(), [witness(4), witness(9)]);
    expect(next.includeWitnesses).toBe(true);
    expect(next.includeSecondWitness).toBe(true);
    expect(next.witness1Id).toBe(4);
    expect(next.witness2Id).toBe(9);
    expect(next.witness1SignatureIncluded).toBe(false);
  });

  it("does not place the same witness twice", () => {
    const next = applyDefaultWitnesses(blank(), [
      witness(4, { autoSign: true }),
      witness(4, { autoSign: false }),
    ]);
    expect(next.witness1Id).toBe(4);
    expect(next.includeSecondWitness).toBe(false);
    expect(next.witness1SignatureIncluded).toBe(true);
  });

  it("leaves a different witness in place and uses the open slot", () => {
    const start = blank();
    start.includeWitnesses = true;
    start.witness1Id = 3;
    start.witness1Name = "Ana";
    const next = applyDefaultWitnesses(start, [witness(3), witness(8)]);
    expect(next.witness1Id).toBe(3);
    expect(next.witness1Name).toBe("Ana");
    expect(next.witness2Id).toBe(8);
  });

  it("auto-signs a witness already on the contract when they have a signature", () => {
    const start = blank();
    start.includeWitnesses = true;
    start.witness1Id = 3;
    start.witness1Name = "Ana";
    const next = applyDefaultWitnesses(start, [
      witness(3, { autoSign: true, eSignatureUrl: "saved" }),
    ]);
    expect(next.witness1SignatureIncluded).toBe(true);
    expect(next.witness1ESignatureUrl).toBe("saved");
    expect(next.witness2Id).toBeNull();
  });

  it("does not auto-sign without a saved signature", () => {
    const next = applyDefaultWitnesses(blank(), [
      witness(4, { autoSign: true, eSignatureUrl: "  " }),
    ]);
    expect(next.witness1Id).toBe(4);
    expect(next.witness1SignatureIncluded).toBe(false);
  });

  it("stops at two witnesses", () => {
    const next = applyDefaultWitnesses(blank(), [
      witness(1),
      witness(2),
      witness(3),
    ]);
    expect(next.witness1Id).toBe(1);
    expect(next.witness2Id).toBe(2);
  });
});
