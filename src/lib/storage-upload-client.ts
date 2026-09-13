import { isR2ConfiguredClientHint } from "$lib/storage-config";

function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid image data.");
  }

  const contentType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return {
    blob: new Blob([bytes], { type: contentType }),
    contentType,
  };
}

/** Upload a compressed image data URL to R2 when configured; otherwise return the data URL. */
export async function persistImageDataUrl(dataUrl: string): Promise<string> {
  if (!isR2ConfiguredClientHint()) {
    return dataUrl;
  }

  const { blob, contentType } = dataUrlToBlob(dataUrl);
  const response = await fetch("/api/storage/upload", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to upload image.";
    throw new Error(message);
  }

  if (!payload || typeof payload.storageRef !== "string") {
    throw new Error("Failed to upload image.");
  }

  return payload.storageRef;
}
