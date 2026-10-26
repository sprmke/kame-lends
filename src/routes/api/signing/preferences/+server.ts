import { json, type RequestHandler } from "@sveltejs/kit";
import { getSession } from "$lib/server/session";
import {
  getUserSigningPreferences,
  updateUserSigningPreferences,
} from "$lib/server/signing/preferences";
import { applyAutoAttachForUserOnAllLoans } from "$lib/server/signing/auto-attach";
import { loadPartyUserIdentityDocuments } from "$lib/server/party-profile";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  return json(await getUserSigningPreferences(session.user.id));
};

export const PUT: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await event.request.json()) as Record<string, unknown>;
  if (typeof body.autoAttachSignature !== "boolean") {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  const enabling = body.autoAttachSignature === true;
  if (enabling) {
    const documents = await loadPartyUserIdentityDocuments(session.user.id);
    if (!documents.eSignatureUrl?.trim()) {
      return json(
        { error: "Upload a saved signature first." },
        { status: 400 },
      );
    }
  }

  const previous = await getUserSigningPreferences(session.user.id);
  const updated = await updateUserSigningPreferences(session.user.id, {
    autoAttachSignature: body.autoAttachSignature,
  });

  if (enabling && !previous.autoAttachSignature) {
    try {
      await applyAutoAttachForUserOnAllLoans({
        userId: session.user.id,
        email: session.user.email ?? null,
      });
    } catch (error) {
      console.error("[signing] auto attach backfill failed", error);
    }
  }

  return json(updated);
};
