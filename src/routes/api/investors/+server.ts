import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  normalizeValidIdUrl,
  normalizeSignatureImageUrl,
} from "$lib/valid-id-document";
import { getCachedInvestors } from "$lib/server/cached-data";
import {
  PartyEmailConflictError,
  upsertWorkspacePartyContact,
} from "$lib/server/party-directory";
import { workspaceAdminForbidden } from "$lib/server/workspace-admin";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const simple = event.url.searchParams.get("simple") === "true";
    return json(await getCachedInvestors(session.user.id, simple));
  } catch (error) {
    console.error("Error fetching investors:", error);
    return json({ error: "Failed to fetch investors" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const forbidden = await workspaceAdminForbidden(session.user.id);
    if (forbidden) return forbidden;

    const body = await event.request.json();
    if (!body.email?.trim()) {
      return json({ error: "Investor email is required" }, { status: 400 });
    }

    const saved = await upsertWorkspacePartyContact({
      workspaceOwnerId: session.user.id,
      role: "investor",
      name: body.name,
      email: body.email,
      contactNumber: body.contactNumber || null,
      address: body.address || null,
      validIdUrl: normalizeValidIdUrl(body.validIdUrl),
      eSignatureUrl: normalizeSignatureImageUrl(body.eSignatureUrl),
      syncDocuments: body.validIdUrl != null || body.eSignatureUrl != null,
    });
    return json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof PartyEmailConflictError) {
      return json({ error: error.message }, { status: 409 });
    }
    console.error("Error creating investor:", error);
    return json({ error: "Failed to create investor" }, { status: 500 });
  }
};
