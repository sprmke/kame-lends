import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { toStorageRef } from "$lib/storage-reference";
import {
  createPresignedUploadUrl,
  createUploadObjectKey,
  extensionForContentType,
  isR2Configured,
} from "$lib/server/storage/r2";

const MAX_UPLOAD_BYTES = 2_000_000;

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return json(
      { error: "Object storage is not configured." },
      { status: 503 },
    );
  }

  const body = await event.request.json().catch(() => null);
  const contentType =
    typeof body?.contentType === "string" ? body.contentType.trim() : "";
  const contentLength =
    typeof body?.contentLength === "number" ? body.contentLength : NaN;

  const ext = extensionForContentType(contentType);
  if (!ext) {
    return json(
      { error: "Please upload a JPEG, PNG, or WebP image." },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_UPLOAD_BYTES
  ) {
    return json({ error: "Image is too large." }, { status: 400 });
  }

  const objectKey = createUploadObjectKey(session.user.id, ext);
  const uploadUrl = await createPresignedUploadUrl(
    objectKey,
    contentType,
    contentLength,
  );

  return json({
    uploadUrl,
    storageRef: toStorageRef(objectKey),
    headers: {
      "Content-Type": contentType,
    },
  });
};
