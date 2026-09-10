import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { parsePartyEntityType } from "$lib/party-profile";
import {
  loadPartyProfileForEntity,
  savePartyProfileForEntity,
} from "$lib/server/party-profile";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";

function parseEntityId(raw: string | undefined): number | null {
  const id = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(id) ? id : null;
}

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const entityType = parsePartyEntityType(event.params.entityType);
    const entityId = parseEntityId(event.params.entityId);
    if (!entityType || entityId == null) {
      return json({ error: "Invalid request" }, { status: 400 });
    }

    if (!(await isWorkspaceAdmin(session.user.id))) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await loadPartyProfileForEntity(
      entityType,
      entityId,
      session.user.id,
    );
    if (!profile) {
      return json({ error: "Not found" }, { status: 404 });
    }

    return json(profile);
  } catch (error) {
    console.error("Error loading party profile:", error);
    return json({ error: "Failed to load profile" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const entityType = parsePartyEntityType(event.params.entityType);
    const entityId = parseEntityId(event.params.entityId);
    if (!entityType || entityId == null) {
      return json({ error: "Invalid request" }, { status: 400 });
    }

    if (!(await isWorkspaceAdmin(session.user.id))) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await event.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const profile = await savePartyProfileForEntity(
      entityType,
      entityId,
      session.user.id,
      {
        name: String(body.name ?? ""),
        email: typeof body.email === "string" ? body.email : null,
        contactNumber:
          typeof body.contactNumber === "string" ? body.contactNumber : null,
        address: typeof body.address === "string" ? body.address : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        validIdUrl:
          typeof body.validIdUrl === "string" || body.validIdUrl === null
            ? body.validIdUrl
            : null,
        eSignatureUrl:
          typeof body.eSignatureUrl === "string" || body.eSignatureUrl === null
            ? body.eSignatureUrl
            : null,
      },
    );

    if (!profile) {
      return json({ error: "Not found" }, { status: 404 });
    }

    return json(profile);
  } catch (error) {
    console.error("Error saving party profile:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save profile";
    return json({ error: message }, { status: 400 });
  }
};
