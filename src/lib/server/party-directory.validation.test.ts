import { describe, expect, it } from "vitest";
import {
  PartyValidationError,
  upsertWorkspacePartyContact,
} from "./party-directory";

describe("party contact validation", () => {
  it("rejects a malformed email before creating a user", async () => {
    await expect(
      upsertWorkspacePartyContact({
        workspaceOwnerId: "owner",
        role: "investor",
        name: "Valid Name",
        email: "not-an-email",
        contactNumber: null,
        address: null,
        validIdUrl: null,
        eSignatureUrl: null,
        syncDocuments: false,
      }),
    ).rejects.toBeInstanceOf(PartyValidationError);
  });

  it("rejects a whitespace-only name", async () => {
    await expect(
      upsertWorkspacePartyContact({
        workspaceOwnerId: "owner",
        role: "borrower",
        name: "   ",
        email: "valid@example.com",
        contactNumber: null,
        address: null,
        validIdUrl: null,
        eSignatureUrl: null,
        syncDocuments: false,
      }),
    ).rejects.toBeInstanceOf(PartyValidationError);
  });
});
