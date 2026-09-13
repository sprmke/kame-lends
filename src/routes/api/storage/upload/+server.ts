import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { toStorageRef } from "$lib/storage-reference";
import {
  createUploadObjectKey,
  extensionForContentType,
  isR2Configured,
  putObjectBytes,
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

  const contentType = event.request.headers.get("content-type")?.trim() ?? "";
  const ext = extensionForContentType(contentType);
  if (!ext) {
    return json(
      { error: "Please upload a JPEG, PNG, or WebP image." },
      { status: 400 },
    );
  }

  const body = new Uint8Array(await event.request.arrayBuffer());
  if (body.byteLength <= 0 || body.byteLength > MAX_UPLOAD_BYTES) {
    return json({ error: "Image is too large." }, { status: 400 });
  }

  const objectKey = createUploadObjectKey(session.user.id, ext);
  await putObjectBytes(objectKey, body, contentType);

  return json({ storageRef: toStorageRef(objectKey) });
};
