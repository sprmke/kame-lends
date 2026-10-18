import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  normalizeValidIdUrl,
  normalizeSignatureImageUrl,
} from "$lib/valid-id-document";
import { getCachedBorrowers } from "$lib/server/cached-data";
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

    const allBorrowers = await getCachedBorrowers(
      session.user.id,
      simple ? "simple" : "full",
    );
    return json(
      simple
        ? allBorrowers.map(
            ({
              id,
              name,
              contactNumber,
              email,
              address,
              validIdUrl,
              eSignatureUrl,
              notes,
              createdAt,
              updatedAt,
            }) => ({
              id,
              name,
              contactNumber,
              email,
              address,
              validIdUrl,
              eSignatureUrl,
              notes,
              createdAt,
              updatedAt,
            }),
          )
        : allBorrowers,
    );
  } catch (error) {
    console.error("Error fetching borrowers:", error);
    return json({ error: "Failed to fetch borrowers" }, { status: 500 });
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

    const body = await requestJson(event.request);

    if (!body.name?.trim()) {
      return json({ error: "Borrower name is required" }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      return json({ error: "Email is required" }, { status: 400 });
    }

    const saved = await upsertWorkspacePartyContact({
      workspaceOwnerId: session.user.id,
      role: "borrower",
      name: body.name,
      email,
      contactNumber: body.contactNumber || null,
      address: body.address || null,
      notes: body.notes || null,
      validIdUrl: normalizeValidIdUrl(body.validIdUrl),
      eSignatureUrl: normalizeSignatureImageUrl(body.eSignatureUrl),
      syncDocuments: true,
    });

    return json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof PartyEmailConflictError) {
      return json({ error: error.message }, { status: 409 });
    }
    console.error("Error creating borrower:", error);
    return json({ error: "Failed to create borrower" }, { status: 500 });
  }
};

async function requestJson(request: Request) {
  return request.json() as Promise<
    Record<string, unknown> & {
      name?: string;
      email?: string;
      contactNumber?: string;
      address?: string;
      notes?: string;
      validIdUrl?: string;
      eSignatureUrl?: string;
    }
  >;
}
