export const MAX_VALID_ID_DATA_URL_LENGTH = 1_100_000;

export function normalizeValidIdUrl(value: unknown): string | null {
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

  if (trimmed.length > MAX_VALID_ID_DATA_URL_LENGTH) {
    return null;
  }

  return trimmed;
}

export async function readValidIdFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file (JPEG, PNG, or WebP).");
  }

  const dataUrl = await compressValidIdImage(file);
  if (dataUrl.length > MAX_VALID_ID_DATA_URL_LENGTH) {
    throw new Error("Image is too large. Please upload a smaller photo.");
  }

  return dataUrl;
}

/**
 * Draws `image` onto a canvas scaled down to fit within `maxDimension`.
 * Pass `background` to flatten transparency (e.g. before JPEG encoding).
 */
export function drawImageToCanvas(
  image: HTMLImageElement,
  maxDimension: number,
  background?: string,
): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image.");
  }

  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

/** Encodes `canvas` as JPEG, backing off quality until it fits under `maxLength` chars. */
export function encodeJpegUnderLimit(
  canvas: HTMLCanvasElement,
  maxLength: number,
  initialQuality: number,
  minQuality: number,
): string {
  let quality = initialQuality;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrl.length > maxLength && quality > minQuality) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return dataUrl;
}

async function compressValidIdImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const canvas = drawImageToCanvas(image, 1200);
    return encodeJpegUnderLimit(
      canvas,
      MAX_VALID_ID_DATA_URL_LENGTH,
      0.85,
      0.45,
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const MAX_SIGNATURE_IMAGE_DATA_URL_LENGTH = MAX_VALID_ID_DATA_URL_LENGTH;

export const normalizeSignatureImageUrl = normalizeValidIdUrl;

export async function readSignatureImageFileAsDataUrl(
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file (JPEG, PNG, or WebP).");
  }

  const dataUrl = await compressSignatureImage(file);
  if (dataUrl.length > MAX_SIGNATURE_IMAGE_DATA_URL_LENGTH) {
    throw new Error("Image is too large. Please upload a smaller signature.");
  }

  return dataUrl;
}

async function compressSignatureImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    // Transparent PNG/WebP signatures become black when flattened to JPEG
    // without an explicit background.
    const canvas = drawImageToCanvas(image, 800, "#ffffff");

    let dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length > MAX_SIGNATURE_IMAGE_DATA_URL_LENGTH) {
      dataUrl = encodeJpegUnderLimit(
        canvas,
        MAX_SIGNATURE_IMAGE_DATA_URL_LENGTH,
        0.92,
        0.5,
      );
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read image file."));
    image.src = src;
  });
}
