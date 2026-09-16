import { isStorageRef } from "$lib/storage-reference";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import type { LoanContractData } from "$lib/loan-contract-data";

const PDF_EMBEDDABLE_IMAGE = /^data:image\/(jpeg|jpg|png);base64,/i;

/** Match signing capture limit; oversized data URLs can OOM or crash react-pdf on serverless. */
export const MAX_PDF_EMBED_DATA_URL_LENGTH = 600_000;

/** @react-pdf Image supports JPEG, PNG, and SVG data URLs. WebP and other formats throw. */
export function pdfSafeImageSrc(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  if (!trimmed || isStorageRef(trimmed)) return null;
  if (trimmed.length > MAX_PDF_EMBED_DATA_URL_LENGTH) return null;
  return PDF_EMBEDDABLE_IMAGE.test(trimmed) ? trimmed : null;
}

export function stripContractEmbeddedImages(
  data: LoanContractData,
  customization?: ContractCustomization,
): { data: LoanContractData; customization?: ContractCustomization } {
  return {
    data: {
      ...data,
      borrowerValidIdUrl: null,
      borrowerESignatureUrl: null,
      lenders: data.lenders.map((lender) => ({
        ...lender,
        validIdUrl: null,
        eSignatureUrl: null,
      })),
    },
    customization: customization
      ? {
          ...customization,
          witness1ValidIdUrl: "",
          witness1ESignatureUrl: "",
          witness2ValidIdUrl: "",
          witness2ESignatureUrl: "",
        }
      : customization,
  };
}
