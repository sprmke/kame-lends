import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";
import { isStorageRef } from "$lib/storage-reference";
import { normalizeValidIdUrl } from "$lib/valid-id-document";
import { extractReceiptInfo } from "$lib/server/ai/receipt-extraction";
import {
  assertStorageRef,
  canReadStorageRef,
} from "$lib/server/storage/access";
import { getObjectAsDataUrl, isR2Configured } from "$lib/server/storage/r2";

export const POST: RequestHandler = async (event) => {
  const { request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isWorkspaceAdmin(session.user.id))) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    let imageDataUrl = normalizeValidIdUrl(body?.imageDataUrl);

    if (
      !imageDataUrl &&
      typeof body?.imageDataUrl === "string" &&
      isStorageRef(body.imageDataUrl)
    ) {
      if (!isR2Configured()) {
        return json(
          { success: false, error: "Object storage is not configured." },
          { status: 503 },
        );
      }
      if (!(await canReadStorageRef(session.user.id, body.imageDataUrl))) {
        return json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      imageDataUrl = await getObjectAsDataUrl(
        assertStorageRef(body.imageDataUrl),
      );
    }

    if (!imageDataUrl) {
      return json(
        { success: false, error: "Please upload a JPEG, PNG, or WebP image." },
        { status: 400 },
      );
    }

    const result = await extractReceiptInfo(imageDataUrl);
    return json(result);
  } catch (error) {
    console.error("Error extracting receipt info:", error);
    return json(
      { success: false, error: "Failed to scan the receipt." },
      { status: 500 },
    );
  }
};
