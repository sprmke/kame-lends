import type { ContractCustomization } from "$lib/loan-contract-customization";
import type { SigningPartyRole } from "$lib/loan-signing";

export function applyAutoAttachFlagsToCustomization(
  customization: ContractCustomization,
  roles: SigningPartyRole[],
  input: {
    lenderEmail?: string | null;
    witness1SignatureUrl?: string | null;
    witness2SignatureUrl?: string | null;
    signedDateIso: string;
  },
): ContractCustomization {
  const next: ContractCustomization = {
    ...customization,
    lenderSignaturesIncluded: { ...customization.lenderSignaturesIncluded },
    lenderDateSigned: { ...customization.lenderDateSigned },
  };

  for (const role of roles) {
    switch (role) {
      case "borrower":
        next.includeBorrowerSignature = true;
        if (!next.borrowerDateSigned?.trim()) {
          next.borrowerDateSigned = input.signedDateIso;
        }
        break;
      case "lender": {
        const email = input.lenderEmail?.trim();
        if (!email) break;
        next.lenderSignaturesIncluded[email] = true;
        if (!next.lenderDateSigned[email]?.trim()) {
          next.lenderDateSigned[email] = input.signedDateIso;
        }
        break;
      }
      case "witness_1":
        next.witness1SignatureIncluded = true;
        if (input.witness1SignatureUrl?.trim()) {
          next.witness1ESignatureUrl = input.witness1SignatureUrl.trim();
        }
        if (!next.witness1DateSigned?.trim()) {
          next.witness1DateSigned = input.signedDateIso;
        }
        break;
      case "witness_2":
        next.includeSecondWitness = true;
        next.witness2SignatureIncluded = true;
        if (input.witness2SignatureUrl?.trim()) {
          next.witness2ESignatureUrl = input.witness2SignatureUrl.trim();
        }
        if (!next.witness2DateSigned?.trim()) {
          next.witness2DateSigned = input.signedDateIso;
        }
        break;
      default:
        break;
    }
  }

  return next;
}
