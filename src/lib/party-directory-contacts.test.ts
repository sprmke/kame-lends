import { describe, expect, it } from "vitest";
import { dedupeDirectoryContacts } from "./party-directory-contacts";

const base = {
  contactNumber: null,
  address: null,
  validIdUrl: null,
  eSignatureUrl: null,
};

describe("dedupeDirectoryContacts", () => {
  it("keeps one row per email and prefers the witness id", () => {
    const rows = dedupeDirectoryContacts([
      {
        ...base,
        id: 4,
        key: "borrower-4",
        kind: "Borrower" as const,
        name: "Ana Cruz",
        email: "Ana@Example.com",
        address: "Cebu",
      },
      {
        ...base,
        id: 9,
        key: "witness-9",
        kind: "Witness" as const,
        name: "Ana Cruz",
        email: "ana@example.com",
      },
      {
        ...base,
        id: 2,
        key: "investor-2",
        kind: "Investor" as const,
        name: "Ana Cruz",
        email: "ana@example.com",
        contactNumber: "0917",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(9);
    expect(rows[0]?.kind).toBe("Witness");
    expect(rows[0]?.address).toBe("Cebu");
    expect(rows[0]?.contactNumber).toBe("0917");
  });

  it("leaves contacts without an email as separate rows", () => {
    const rows = dedupeDirectoryContacts([
      {
        ...base,
        id: 1,
        key: "borrower-1",
        kind: "Borrower" as const,
        name: "No Email",
        email: null,
      },
      {
        ...base,
        id: 2,
        key: "witness-2",
        kind: "Witness" as const,
        name: "Also None",
        email: "  ",
      },
    ]);

    expect(rows.map((row) => row.id)).toEqual([1, 2]);
  });
});
