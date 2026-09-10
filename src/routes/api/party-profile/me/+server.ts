import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  loadPartyUserIdentityDocuments,
  savePartyUserIdentityDocuments,
} from "$lib/server/party-profile";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await loadPartyUserIdentityDocuments(session.user.id);
    return json(documents);
  } catch (error) {
    console.error("Error loading party identity documents:", error);
    return json(
      { error: "Failed to load identity documents" },
      { status: 500 },
    );
  }
};

export const PUT: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await event.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const documents = await savePartyUserIdentityDocuments(session.user.id, {
      validIdUrl:
        typeof body.validIdUrl === "string" || body.validIdUrl === null
          ? body.validIdUrl
          : null,
      eSignatureUrl:
        typeof body.eSignatureUrl === "string" || body.eSignatureUrl === null
          ? body.eSignatureUrl
          : null,
    });

    return json(documents);
  } catch (error) {
    console.error("Error saving party identity documents:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save identity documents";
    const status = message === "No linked contact records" ? 404 : 400;
    return json({ error: message }, { status });
  }
};
