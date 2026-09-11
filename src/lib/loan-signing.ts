import type { ContractCustomization } from "./loan-contract-customization";
import {
  buildDefaultContractCustomizationFromLoan,
  type ContractCustomization as ContractCustomizationType,
} from "./loan-contract-customization";
import {
  buildLoanContractData,
  type LoanContractData,
  type LoanContractDraftInput,
} from "./loan-contract-data";
import type { LoanWithInvestors } from "./types";

export type SigningPartyRole =
  "borrower" | "lender" | "witness_1" | "witness_2";

export interface SigningInvitationRecord {
  id: number;
  token: string | null;
  partyRole: SigningPartyRole;
  investorId: number | null;
  partyName: string;
  partyEmail: string | null;
  signatureDataUrl: string | null;
  signedAt: Date | string | null;
  consentedAt: Date | string | null;
  expiresAt: Date | string | null;
  loanId?: number;
}

export interface SigningInvitationSummary {
  id: number;
  token: string | null;
  partyRole: SigningPartyRole;
  partyName: string;
  partyEmail: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  signingUrl: string;
  loanId?: number;
}

const MAX_SIGNATURE_DATA_URL_LENGTH = 600_000;

import { publicAppUrl } from "$lib/public-env";

export function buildAuthenticatedSigningUrl(
  loanId: number,
  origin?: string,
): string {
  const base = origin ?? publicAppUrl();
  const path = `/loans/${loanId}/sign`;
  if (base) {
    return `${base.replace(/\/$/, "")}${path}`;
  }
  return path;
}

/** @deprecated Prefer buildAuthenticatedSigningUrl(loanId). Kept for legacy token redirects. */
export function buildSigningUrl(token: string, origin?: string): string {
  const base = origin ?? publicAppUrl();
  if (base) {
    return `${base.replace(/\/$/, "")}/sign/${token}`;
  }
  return `/sign/${token}`;
}

export function normalizeEmail(
  email: string | null | undefined,
): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

export function emailsMatch(
  provided: string,
  expected: string | null | undefined,
): boolean {
  const normalizedExpected = normalizeEmail(expected);
  if (!normalizedExpected) return true;
  return normalizeEmail(provided) === normalizedExpected;
}

export function isValidSignatureDataUrl(value: string): boolean {
  if (!value.startsWith("data:image/png;base64,")) return false;
  if (value.length > MAX_SIGNATURE_DATA_URL_LENGTH) return false;
  const base64 = value.slice("data:image/png;base64,".length);
  return base64.length > 100;
}

export function resolveContractCustomization(
  loan: LoanWithInvestors,
  storedCustomization?: ContractCustomizationType | null,
): ContractCustomization {
  if (storedCustomization) {
    return storedCustomization;
  }
  const data = buildLoanContractData(loan);
  return buildDefaultContractCustomizationFromLoan(data);
}

export interface SavedPartySignatures {
  borrower: string | null;
  lenders: Map<string, string>;
}

/** Manual contract signature wins; saved CRM signature only when admin opted in. */
export function resolvePartySignature(
  manualSignature: string | null | undefined,
  savedSignature: string | null | undefined,
  includeSavedSignature: boolean,
): string | null {
  const manual = manualSignature?.trim() || null;
  if (manual) return manual;
  if (includeSavedSignature) {
    const saved = savedSignature?.trim() || null;
    if (saved) return saved;
  }
  return null;
}

export function buildSavedPartySignaturesFromLoan(
  loan: LoanWithInvestors,
): SavedPartySignatures {
  const lenders = new Map<string, string>();
  for (const loanInvestor of loan.loanInvestors) {
    const email = loanInvestor.investor.email;
    const signature = loanInvestor.investor.eSignatureUrl?.trim();
    if (signature && !lenders.has(email)) {
      lenders.set(email, signature);
    }
  }

  return {
    borrower: loan.borrower?.eSignatureUrl?.trim() || null,
    lenders,
  };
}

export function buildSavedPartySignaturesFromDraft(
  draft: LoanContractDraftInput,
): SavedPartySignatures {
  const lenders = new Map<string, string>();
  for (const allocation of draft.investors) {
    const signature = allocation.investor.eSignatureUrl?.trim();
    if (signature && !lenders.has(allocation.investor.email)) {
      lenders.set(allocation.investor.email, signature);
    }
  }

  return {
    borrower: draft.borrowerESignatureUrl?.trim() || null,
    lenders,
  };
}

function findInvitationSignature(
  invitations: SigningInvitationRecord[],
  partyRole: SigningPartyRole,
  investorEmailById: Map<number, string>,
  lenderEmail?: string,
): string | null {
  for (const invitation of invitations) {
    if (invitation.partyRole !== partyRole) continue;
    if (partyRole === "lender") {
      if (!lenderEmail || !invitation.investorId) continue;
      if (investorEmailById.get(invitation.investorId) !== lenderEmail) {
        continue;
      }
    }
    return invitation.signatureDataUrl?.trim() || null;
  }
  return null;
}

function findInvitationSignedDate(
  invitations: SigningInvitationRecord[],
  partyRole: SigningPartyRole,
  investorEmailById: Map<number, string>,
  lenderEmail?: string,
): string | undefined {
  for (const invitation of invitations) {
    if (invitation.partyRole !== partyRole) continue;
    if (partyRole === "lender") {
      if (!lenderEmail || !invitation.investorId) continue;
      if (investorEmailById.get(invitation.investorId) !== lenderEmail) {
        continue;
      }
    }
    if (invitation.signedAt == null) continue;
    return new Date(invitation.signedAt).toISOString().slice(0, 10);
  }
  return undefined;
}

export function applySigningSignatures(
  data: LoanContractData,
  customization: ContractCustomization,
  invitations: SigningInvitationRecord[],
  investorEmailById: Map<number, string>,
  savedSignatures: SavedPartySignatures,
): { data: LoanContractData; customization: ContractCustomization } {
  const nextData: LoanContractData = {
    ...data,
    lenders: data.lenders.map((lender) => ({ ...lender })),
  };
  const nextCustomization: ContractCustomization = {
    ...customization,
    lenderDateSigned: { ...customization.lenderDateSigned },
  };

  const borrowerManual = findInvitationSignature(
    invitations,
    "borrower",
    investorEmailById,
  );
  nextData.borrowerESignatureUrl = resolvePartySignature(
    borrowerManual,
    savedSignatures.borrower,
    customization.includeBorrowerSignature === true,
  );
  const borrowerSignedDate = findInvitationSignedDate(
    invitations,
    "borrower",
    investorEmailById,
  );
  if (borrowerSignedDate) {
    nextCustomization.borrowerDateSigned = borrowerSignedDate;
  }

  nextData.lenders = nextData.lenders.map((lender) => {
    const manual = findInvitationSignature(
      invitations,
      "lender",
      investorEmailById,
      lender.email,
    );
    const saved = savedSignatures.lenders.get(lender.email) ?? null;
    const includeSaved =
      customization.lenderSignaturesIncluded?.[lender.email] === true;
    const signedDate = findInvitationSignedDate(
      invitations,
      "lender",
      investorEmailById,
      lender.email,
    );
    if (signedDate) {
      nextCustomization.lenderDateSigned[lender.email] = signedDate;
    }
    return {
      ...lender,
      eSignatureUrl: resolvePartySignature(manual, saved, includeSaved),
    };
  });

  const witness1Manual = findInvitationSignature(
    invitations,
    "witness_1",
    investorEmailById,
  );
  nextCustomization.witness1ESignatureUrl =
    resolvePartySignature(
      witness1Manual,
      customization.witness1ESignatureUrl?.trim() || null,
      customization.witness1SignatureIncluded === true,
    ) ?? "";
  const witness1SignedDate = findInvitationSignedDate(
    invitations,
    "witness_1",
    investorEmailById,
  );
  if (witness1SignedDate) {
    nextCustomization.witness1DateSigned = witness1SignedDate;
  }

  const witness2Manual = findInvitationSignature(
    invitations,
    "witness_2",
    investorEmailById,
  );
  nextCustomization.witness2ESignatureUrl =
    resolvePartySignature(
      witness2Manual,
      customization.witness2ESignatureUrl?.trim() || null,
      customization.witness2SignatureIncluded === true,
    ) ?? "";
  const witness2SignedDate = findInvitationSignedDate(
    invitations,
    "witness_2",
    investorEmailById,
  );
  if (witness2SignedDate) {
    nextCustomization.witness2DateSigned = witness2SignedDate;
  }

  return { data: nextData, customization: nextCustomization };
}

export function applyLiveSignaturePreview(
  data: LoanContractData,
  customization: ContractCustomization,
  partyRole: SigningPartyRole,
  signatureDataUrl: string | null | undefined,
  partyEmail?: string | null,
): { data: LoanContractData; customization: ContractCustomization } {
  if (!signatureDataUrl) {
    return { data, customization };
  }

  const nextData: LoanContractData = {
    ...data,
    lenders: data.lenders.map((lender) => ({ ...lender })),
  };
  const nextCustomization: ContractCustomization = {
    ...customization,
    lenderDateSigned: { ...customization.lenderDateSigned },
  };

  switch (partyRole) {
    case "borrower":
      nextData.borrowerESignatureUrl = signatureDataUrl;
      break;
    case "lender":
      if (partyEmail) {
        nextData.lenders = nextData.lenders.map((lender) =>
          lender.email === partyEmail
            ? { ...lender, eSignatureUrl: signatureDataUrl }
            : lender,
        );
      }
      break;
    case "witness_1":
      nextCustomization.witness1ESignatureUrl = signatureDataUrl;
      break;
    case "witness_2":
      nextCustomization.witness2ESignatureUrl = signatureDataUrl;
      break;
  }

  return { data: nextData, customization: nextCustomization };
}

export function signingPartyRoleMatchesBlock(
  partyRole: SigningPartyRole,
  blockRole: string,
  partyEmail?: string | null,
  blockEmail?: string | null,
): boolean {
  switch (partyRole) {
    case "borrower":
      return blockRole === "Borrower";
    case "lender":
      return (
        (blockRole === "Lender" || blockRole.startsWith("Lender ")) &&
        Boolean(partyEmail && partyEmail === blockEmail)
      );
    case "witness_1":
      return blockRole === "Witness 1";
    case "witness_2":
      return blockRole === "Witness 2";
    default:
      return false;
  }
}

export function buildInvestorEmailMap(
  loan: LoanWithInvestors,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const li of loan.loanInvestors) {
    if (!map.has(li.investorId)) {
      map.set(li.investorId, li.investor.email);
    }
  }
  return map;
}

export interface CreateSigningInvitationInput {
  loanId: number;
  contractId: number;
  partyRole: SigningPartyRole;
  partyName: string;
  partyEmail?: string | null;
  investorId?: number | null;
  witnessId?: number | null;
}

export function getWitnessInvitationPartyName(
  witnessRole: "witness_1" | "witness_2",
  customization: ContractCustomization,
): string {
  const raw =
    witnessRole === "witness_1"
      ? customization.witness1Name
      : customization.witness2Name;
  const name = typeof raw === "string" ? raw.trim() : "";

  if (name) {
    return name;
  }

  return witnessRole === "witness_1" ? "Witness 1" : "Witness 2";
}

export function resolveSigningPartyDisplayName(
  partyRole: SigningPartyRole,
  partyName: string,
  customization?: ContractCustomization | null,
): string {
  switch (partyRole) {
    case "witness_1":
    case "witness_2":
      if (customization) {
        return getWitnessInvitationPartyName(partyRole, customization);
      }
      return (
        partyName.trim() ||
        (partyRole === "witness_1" ? "Witness 1" : "Witness 2")
      );
    default:
      return partyName;
  }
}

export function buildSigningInvitationsForLoan(
  loan: LoanWithInvestors,
  contractId: number,
  customization: ContractCustomization,
): CreateSigningInvitationInput[] {
  const invitations: CreateSigningInvitationInput[] = [];

  if (loan.borrower) {
    invitations.push({
      loanId: loan.id,
      contractId,
      partyRole: "borrower",
      partyName: loan.borrower.name,
      partyEmail: loan.borrower.email,
    });
  }

  const seenInvestorIds = new Set<number>();
  for (const li of loan.loanInvestors) {
    if (seenInvestorIds.has(li.investorId)) continue;
    seenInvestorIds.add(li.investorId);
    invitations.push({
      loanId: loan.id,
      contractId,
      partyRole: "lender",
      partyName: li.investor.name,
      partyEmail: li.investor.email,
      investorId: li.investorId,
    });
  }

  if (customization.includeWitnesses) {
    invitations.push({
      loanId: loan.id,
      contractId,
      partyRole: "witness_1",
      partyName: getWitnessInvitationPartyName("witness_1", customization),
      partyEmail: normalizeEmail(customization.witness1Email) || null,
      witnessId: customization.witness1Id ?? null,
    });

    const includeSecond =
      customization.includeSecondWitness ||
      Boolean(
        (customization.witness2Name || "").trim() ||
        (customization.witness2Address || "").trim() ||
        (customization.witness2ValidIdUrl || "").trim() ||
        (customization.witness2ESignatureUrl || "").trim(),
      );

    if (includeSecond) {
      invitations.push({
        loanId: loan.id,
        contractId,
        partyRole: "witness_2",
        partyName: getWitnessInvitationPartyName("witness_2", customization),
        partyEmail: normalizeEmail(customization.witness2Email) || null,
        witnessId: customization.witness2Id ?? null,
      });
    }
  }

  return invitations;
}

export function isSigningInvitationIncluded(
  invitation: Pick<SigningInvitationRecord, "partyRole" | "investorId">,
  _loan: LoanWithInvestors,
  customization: ContractCustomization,
): boolean {
  switch (invitation.partyRole) {
    case "borrower":
    case "lender":
      return true;
    case "witness_1":
      return customization.includeWitnesses;
    case "witness_2": {
      if (!customization.includeWitnesses) {
        return false;
      }
      return (
        customization.includeSecondWitness ||
        Boolean(
          customization.witness2Name.trim() ||
          customization.witness2Address.trim() ||
          customization.witness2ValidIdUrl.trim() ||
          customization.witness2ESignatureUrl.trim(),
        )
      );
    }
    default:
      return true;
  }
}

const SIGNING_ROLE_ORDER: Record<SigningPartyRole, number> = {
  borrower: 0,
  lender: 1,
  witness_1: 2,
  witness_2: 3,
};

export function sortSigningInvitations<
  T extends { id: number; partyRole: SigningPartyRole },
>(invitations: T[]): T[] {
  return [...invitations].sort((a, b) => {
    const roleDiff =
      SIGNING_ROLE_ORDER[a.partyRole] - SIGNING_ROLE_ORDER[b.partyRole];
    if (roleDiff !== 0) return roleDiff;
    return a.id - b.id;
  });
}

export function toSigningInvitationSummary(
  invitation: SigningInvitationRecord,
  origin?: string,
  loanId?: number,
): SigningInvitationSummary {
  const resolvedLoanId = loanId ?? invitation.loanId;
  return {
    id: invitation.id,
    token: invitation.token,
    partyRole: invitation.partyRole,
    partyName: invitation.partyName,
    partyEmail: invitation.partyEmail,
    signedAt: invitation.signedAt
      ? new Date(invitation.signedAt).toISOString()
      : null,
    expiresAt: invitation.expiresAt
      ? new Date(invitation.expiresAt).toISOString()
      : null,
    signingUrl: resolvedLoanId
      ? buildAuthenticatedSigningUrl(resolvedLoanId, origin)
      : invitation.token
        ? buildSigningUrl(invitation.token, origin)
        : "/loans",
    loanId: resolvedLoanId,
  };
}
