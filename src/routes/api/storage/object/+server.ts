import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { isStorageRef } from "$lib/storage-reference";
import {
  assertStorageRef,
  canReadStorageRef,
} from "$lib/server/storage/access";
import {
  createPresignedDownloadUrl,
  isR2Configured,
} from "$lib/server/storage/r2";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ref = event.url.searchParams.get("ref")?.trim() ?? "";
  if (!isStorageRef(ref)) {
    return new Response("Invalid reference", { status: 400 });
  }

  if (!isR2Configured()) {
    return new Response("Object storage is not configured.", { status: 503 });
  }

  if (!(await canReadStorageRef(session.user.id, ref))) {
    return new Response("Forbidden", { status: 403 });
  }

  const objectKey = assertStorageRef(ref);
  const downloadUrl = await createPresignedDownloadUrl(objectKey);
  throw redirect(302, downloadUrl);
};
