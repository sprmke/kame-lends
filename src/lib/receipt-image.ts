import {
  loadImage,
  drawImageToCanvas,
  encodeJpegUnderLimit,
} from "$lib/valid-id-document";

import { normalizeStoredImageRef } from "$lib/storage-reference";

export const MAX_RECEIPT_DATA_URL_LENGTH = 1_100_000;

/** `accept` for receipt file inputs. HEIC/HEIF are re-encoded to JPEG where the browser can decode them. */
export const RECEIPT_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export function normalizeReceiptImageUrl(value: unknown): string | null {
  return normalizeStoredImageRef(value, MAX_RECEIPT_DATA_URL_LENGTH);
}

/** iPhone photos: some browsers report an empty `type`, so check the extension too. */
export function isHeicFile(file: Pick<File, "name" | "type">): boolean {
  return (
    /^image\/hei[cf]$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
  );
}

export async function readReceiptFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/") && !isHeicFile(file)) {
    throw new Error("Please upload an image file (JPEG, PNG, WebP, or HEIC).");
  }

  const dataUrl = await compressReceiptImage(file);
  if (dataUrl.length > MAX_RECEIPT_DATA_URL_LENGTH) {
    throw new Error("Image is too large. Please upload a smaller photo.");
  }

  return dataUrl;
}

async function drawFromBlob(blob: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImage(objectUrl);
    const canvas = drawImageToCanvas(image, 1600);
    return encodeJpegUnderLimit(canvas, MAX_RECEIPT_DATA_URL_LENGTH, 0.92, 0.5);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Slightly larger max dimension and higher starting quality than the valid-ID
 * compressor - receipt screenshots often contain small text that AI extraction
 * needs to read, so we bias toward legibility before falling back on quality.
 */
async function compressReceiptImage(file: File): Promise<string> {
  try {
    return await drawFromBlob(file);
  } catch (error) {
    // Safari (and every iOS browser) decodes HEIC natively, and iOS converts to
    // JPEG when picking. Other desktop browsers cannot read HEIC; a converter would
    // add ~1.3 MB to every PWA install, so ask for a JPEG instead.
    if (isHeicFile(file)) {
      throw new Error(
        "This browser can't open HEIC photos. Use a screenshot or export it as JPEG.",
        { cause: error },
      );
    }
    throw error;
  }
}
