import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loanSigningInvitations } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import {
  isValidSignatureDataUrl,
  type SigningPartyRole,
} from "$lib/loan-signing";
import { resolveAuthenticatedSigningPayload } from "$lib/server/loan-signing-server";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = Number(event.params.id);
    if (Number.isNaN(loanId)) {
      return json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const preferredRole = event.url.searchParams.get(
      "role",
    ) as SigningPartyRole | null;
    const result = await resolveAuthenticatedSigningPayload({
      loanId,
      userId: session.user.id,
      sessionEmail: session.user.email,
      preferredRole,
    });

    if ("error" in result && result.error === "not_found") {
      return json({ error: "Loan not found" }, { status: 404 });
    }
    if ("error" in result && result.error === "no_slot") {
      return json(
        { error: "No signature slot for this account" },
        { status: 403 },
      );
    }

    return json(result.payload);
  } catch (error) {
    console.error("Error loading authenticated signing page:", error);
    return json({ error: "Failed to load signing page" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = Number(event.params.id);
    if (Number.isNaN(loanId)) {
      return json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const body = await event.request.json();
    const preferredRole = (body.partyRole ??
      event.url.searchParams.get("role")) as SigningPartyRole | null;

    const result = await resolveAuthenticatedSigningPayload({
      loanId,
      userId: session.user.id,
      sessionEmail: session.user.email,
      preferredRole,
    });

    if ("error" in result && result.error === "not_found") {
      return json({ error: "Loan not found" }, { status: 404 });
    }
    if ("error" in result && result.error === "no_slot") {
      return json(
        { error: "No signature slot for this account" },
        { status: 403 },
      );
    }

    const invitation = result.invitation!;

    if (body.action !== "sign") {
      return json({ error: "Invalid action" }, { status: 400 });
    }

    if (invitation.signedAt) {
      return json(
        {
          error:
            "This signature slot has already been signed and cannot be changed.",
        },
        { status: 409 },
      );
    }

    if (body.consentAccepted !== true) {
      return json(
        {
          error:
            "You must accept the terms and consent to sign electronically.",
        },
        { status: 400 },
      );
    }

    const signatureDataUrl = String(body.signatureDataUrl ?? "");
    if (!isValidSignatureDataUrl(signatureDataUrl)) {
      return json(
        { error: "A valid drawn signature is required." },
        { status: 400 },
      );
    }

    const now = new Date();
    await db
      .update(loanSigningInvitations)
      .set({
        signatureDataUrl,
        signedAt: now,
        consentedAt: now,
        updatedAt: now,
      })
      .where(eq(loanSigningInvitations.id, invitation.id));

    const refreshed = await resolveAuthenticatedSigningPayload({
      loanId,
      userId: session.user.id,
      sessionEmail: session.user.email,
      preferredRole: invitation.partyRole,
    });

    if (!("payload" in refreshed) || !refreshed.payload) {
      return json({ error: "Failed to reload signing page" }, { status: 500 });
    }

    return json(refreshed.payload);
  } catch (error) {
    console.error("Error submitting authenticated signature:", error);
    return json({ error: "Failed to submit signature" }, { status: 500 });
  }
};
