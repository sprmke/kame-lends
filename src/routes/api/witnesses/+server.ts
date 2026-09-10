import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { witnesses } from "$lib/server/db/schema";
import { invalidateWitnessData } from "$lib/server/cache-invalidation";
import { getCachedWitnesses } from "$lib/server/cached-data";
import {
  normalizeSignatureImageUrl,
  normalizeValidIdUrl,
} from "$lib/valid-id-document";
import { findOrCreatePartyUser } from "$lib/server/party-user";
import { workspaceAdminForbidden } from "$lib/server/workspace-admin";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const simple = event.url.searchParams.get("simple") === "true";
    const query = event.url.searchParams.get("q")?.trim().toLowerCase();
    const allWitnesses = await getCachedWitnesses(
      session.user.id,
      simple ? "simple" : "full",
    );
    const filtered = query
      ? allWitnesses.filter((witness) =>
          [witness.name, witness.email, witness.contactNumber].some((value) =>
            value?.toLowerCase().includes(query),
          ),
        )
      : allWitnesses;

    return json(
      simple
        ? filtered.map(
            ({
              id,
              name,
              contactNumber,
              email,
              address,
              validIdUrl,
              eSignatureUrl,
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
              createdAt,
              updatedAt,
            }),
          )
        : filtered,
    );
  } catch (error) {
    console.error("Error fetching witnesses:", error);
    return json({ error: "Failed to fetch witnesses" }, { status: 500 });
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
    if (!body.name?.trim()) {
      return json({ error: "Witness name is required" }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const partyUser = email
      ? await findOrCreatePartyUser({
          email,
          name: body.name,
          role: "witness",
        })
      : null;

    const [created] = await db
      .insert(witnesses)
      .values({
        userId: session.user.id,
        witnessUserId: partyUser?.id ?? null,
        name: body.name.trim(),
        email: email || null,
        contactNumber: body.contactNumber?.trim() || null,
        address: body.address?.trim() || null,
        validIdUrl: normalizeValidIdUrl(body.validIdUrl),
        eSignatureUrl: normalizeSignatureImageUrl(body.eSignatureUrl),
      })
      .returning();

    invalidateWitnessData();
    return json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating witness:", error);
    return json({ error: "Failed to create witness" }, { status: 500 });
  }
};
