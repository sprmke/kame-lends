import type { PaymentMethod } from "$lib/types";

export type PartyEntityType = "investor" | "borrower" | "witness";

export interface PartyUserProfile {
  name: string;
  email: string | null;
  contactNumber: string | null;
  address: string | null;
  notes: string | null;
  validIdUrl: string | null;
  eSignatureUrl: string | null;
  partyUserId: string | null;
  paymentMethods: PaymentMethod[];
  linkedRoles: PartyEntityType[];
}

export interface PartyProfileSaveInput {
  name: string;
  email: string | null;
  contactNumber: string | null;
  address: string | null;
  notes: string | null;
  validIdUrl: string | null;
  eSignatureUrl: string | null;
}

export interface PartyIdentityDocuments {
  validIdUrl: string | null;
  eSignatureUrl: string | null;
}

export interface PartyIdentityDocumentsSaveInput {
  validIdUrl: string | null;
  eSignatureUrl: string | null;
}

export function parsePartyEntityType(
  raw: string | undefined,
): PartyEntityType | null {
  if (raw === "investor" || raw === "borrower" || raw === "witness") {
    return raw;
  }
  return null;
}
