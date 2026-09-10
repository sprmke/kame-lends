import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { borrowers } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import {
  normalizeValidIdUrl,
  normalizeSignatureImageUrl,
} from "$lib/valid-id-document";
import { getCachedBorrowers } from "$lib/server/cached-data";
import { invalidateBorrowerData } from "$lib/server/cache-invalidation";
import { findOrCreatePartyUser } from "$lib/server/party-user";
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
    const partyUser = email
      ? await findOrCreatePartyUser({
          email,
          name: body.name,
          role: "borrower",
        })
      : null;

    const newBorrower = await db
      .insert(borrowers)
      .values({
        userId: session.user.id,
        borrowerUserId: partyUser?.id ?? null,
        name: body.name.trim(),
        contactNumber: body.contactNumber || null,
        email: email || null,
        address: body.address || null,
        notes: body.notes || null,
        validIdUrl: normalizeValidIdUrl(body.validIdUrl),
        eSignatureUrl: normalizeSignatureImageUrl(body.eSignatureUrl),
      })
      .returning();

    invalidateBorrowerData();
    return json(newBorrower[0], { status: 201 });
  } catch (error) {
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
