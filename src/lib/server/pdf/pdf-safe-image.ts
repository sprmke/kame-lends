import type { ContractCustomization } from "$lib/loan-contract-customization";
import type { LoanContractData } from "$lib/loan-contract-data";

const PDF_EMBEDDABLE_IMAGE = /^data:image\/(jpeg|jpg|png);base64,/i;

/** @react-pdf Image supports JPEG, PNG, and SVG data URLs. WebP and other formats throw. */
export function pdfSafeImageSrc(src: string | null | undefined): string | null {
  const trimmed = src?.trim();
  if (!trimmed) return null;
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
