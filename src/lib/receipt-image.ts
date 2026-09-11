import {
  loadImage,
  drawImageToCanvas,
  encodeJpegUnderLimit,
} from "$lib/valid-id-document";

export const MAX_RECEIPT_DATA_URL_LENGTH = 1_100_000;

export function normalizeReceiptImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (
    !trimmed.startsWith("data:image/jpeg;base64,") &&
    !trimmed.startsWith("data:image/png;base64,") &&
    !trimmed.startsWith("data:image/webp;base64,")
  ) {
    return null;
  }

  if (trimmed.length > MAX_RECEIPT_DATA_URL_LENGTH) {
    return null;
  }

  return trimmed;
}

export async function readReceiptFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file (JPEG, PNG, or WebP).");
  }

  const dataUrl = await compressReceiptImage(file);
  if (dataUrl.length > MAX_RECEIPT_DATA_URL_LENGTH) {
    throw new Error("Image is too large. Please upload a smaller photo.");
  }

  return dataUrl;
}

/**
 * Slightly larger max dimension and higher starting quality than the valid-ID
 * compressor - receipt screenshots often contain small text that AI extraction
 * needs to read, so we bias toward legibility before falling back on quality.
 */
async function compressReceiptImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = drawImageToCanvas(image, 1600);
    return encodeJpegUnderLimit(canvas, MAX_RECEIPT_DATA_URL_LENGTH, 0.92, 0.5);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
