import { describe, expect, it } from "vitest";
import {
  contractLenderListKey,
  type ContractLender,
} from "./loan-contract-data";

function lender(overrides: Partial<ContractLender> = {}): ContractLender {
  return {
    name: "Investor A",
    contactNumber: null,
    email: "",
    address: null,
    validIdUrl: null,
    eSignatureUrl: null,
    principalAmount: 1000,
    interestDescription: "10%",
    ...overrides,
  };
}

describe("contractLenderListKey", () => {
  it("returns distinct keys when email is empty for multiple lenders", () => {
    const a = lender({ name: "A", email: "" });
    const b = lender({ name: "B", email: "" });
    expect(contractLenderListKey(a, 0)).not.toBe(contractLenderListKey(b, 1));
  });

  it("returns distinct keys for duplicate emails at different indexes", () => {
    const a = lender({ email: "same@example.com" });
    const b = lender({ email: "same@example.com" });
    expect(contractLenderListKey(a, 0)).not.toBe(contractLenderListKey(b, 1));
  });
});
