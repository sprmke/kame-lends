import { isR2ConfiguredClientHint } from "$lib/storage-config";

type UploadUrlResponse = {
  uploadUrl: string;
  storageRef: string;
  headers: {
    "Content-Type": string;
  };
};

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

async function requestUploadUrl(
  contentType: string,
  contentLength: number,
): Promise<UploadUrlResponse> {
  const response = await fetch("/api/storage/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, contentLength }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to prepare upload.";
    throw new Error(message);
  }

  return payload as UploadUrlResponse;
}

/** Upload a compressed image data URL to R2 when configured; otherwise return the data URL. */
export async function persistImageDataUrl(dataUrl: string): Promise<string> {
  if (!isR2ConfiguredClientHint()) {
    return dataUrl;
  }

  const { blob, contentType } = dataUrlToBlob(dataUrl);
  const { uploadUrl, storageRef, headers } = await requestUploadUrl(
    contentType,
    blob.size,
  );

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload image.");
  }

  return storageRef;
}
