import { isStorageRef, parseStorageKey } from "$lib/storage-reference";
import { getObjectAsDataUrl, isR2Configured } from "$lib/server/storage/r2";
import { pdfSafeImageSrc } from "$lib/server/pdf/pdf-safe-image";

function coerceImageRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function resolveImageForPdf(
  value: string | null | undefined,
): Promise<string | null> {
  const trimmed = coerceImageRef(value);
  if (!trimmed) return null;

  if (isStorageRef(trimmed)) {
    if (!isR2Configured()) return null;
    const key = parseStorageKey(trimmed);
    if (!key) return null;
    try {
      const dataUrl = await getObjectAsDataUrl(key);
      return pdfSafeImageSrc(dataUrl);
    } catch {
      return null;
    }
  }

  return pdfSafeImageSrc(trimmed);
}

export async function resolveStoredImageUrl(
  value: string | null | undefined,
): Promise<string | null> {
  const trimmed = coerceImageRef(value);
  if (!trimmed) return null;

  if (isStorageRef(trimmed)) {
    if (!isR2Configured()) return null;
    const key = parseStorageKey(trimmed);
    if (!key) return null;
    try {
      return await getObjectAsDataUrl(key);
    } catch {
      return null;
    }
  }

  return trimmed;
}

type ContractPartyFields = {
  validIdUrl?: string | null;
  eSignatureUrl?: string | null;
};

export async function resolveContractPartyImages<T extends ContractPartyFields>(
  party: T,
): Promise<T> {
  const [validIdUrl, eSignatureUrl] = await Promise.all([
    resolveImageForPdf(party.validIdUrl),
    resolveImageForPdf(party.eSignatureUrl),
  ]);

  return {
    ...party,
    validIdUrl,
    eSignatureUrl,
  };
}

export async function resolveLoanContractDataImages<
  T extends {
    borrowerValidIdUrl?: string | null;
    borrowerESignatureUrl?: string | null;
    lenders: ContractPartyFields[];
  },
>(data: T): Promise<T> {
  const [borrowerValidIdUrl, borrowerESignatureUrl, lenders] =
    await Promise.all([
      resolveImageForPdf(data.borrowerValidIdUrl),
      resolveImageForPdf(data.borrowerESignatureUrl),
      Promise.all(
        data.lenders.map((lender) => resolveContractPartyImages(lender)),
      ),
    ]);

  return {
    ...data,
    borrowerValidIdUrl,
    borrowerESignatureUrl,
    lenders,
  };
}

export async function resolveContractCustomizationImages<
  T extends {
    witness1ValidIdUrl?: string;
    witness1ESignatureUrl?: string;
    witness2ValidIdUrl?: string;
    witness2ESignatureUrl?: string;
  },
>(customization: T): Promise<T> {
  const [
    witness1ValidIdUrl,
    witness1ESignatureUrl,
    witness2ValidIdUrl,
    witness2ESignatureUrl,
  ] = await Promise.all([
    resolveImageForPdf(customization.witness1ValidIdUrl),
    resolveImageForPdf(customization.witness1ESignatureUrl),
    resolveImageForPdf(customization.witness2ValidIdUrl),
    resolveImageForPdf(customization.witness2ESignatureUrl),
  ]);

  return {
    ...customization,
    witness1ValidIdUrl: witness1ValidIdUrl ?? "",
    witness1ESignatureUrl: witness1ESignatureUrl ?? "",
    witness2ValidIdUrl: witness2ValidIdUrl ?? "",
    witness2ESignatureUrl: witness2ESignatureUrl ?? "",
  };
}
