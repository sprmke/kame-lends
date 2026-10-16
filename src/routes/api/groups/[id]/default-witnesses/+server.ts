import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { loanGroupDefaultWitnesses, witnesses } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import {
  hasGroupManageAccess,
  hasGroupViewAccess,
} from "$lib/server/group-access";
import {
  defaultWitnessesBodySchema,
  parseJsonBody,
} from "$lib/group-validation";
import { loadDefaultWitnessesForGroups } from "$lib/server/groups/apply-default-witnesses";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupViewAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const rows = await loadDefaultWitnessesForGroups([groupId]);
    return json({ witnesses: rows });
  } catch (error) {
    console.error("Error loading default witnesses:", error);
    return json({ error: "Failed to load witnesses" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const parsed = parseJsonBody(
      defaultWitnessesBodySchema,
      await event.request.json(),
    );
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }

    const selected = parsed.data.witnesses;
    if (selected.length > 0) {
      const owned = await db
        .select({ id: witnesses.id })
        .from(witnesses)
        .where(
          and(
            eq(witnesses.userId, session.user.id),
            inArray(
              witnesses.id,
              selected.map((row) => row.witnessId),
            ),
          ),
        );
      if (owned.length !== selected.length) {
        return json({ error: "Unknown witness" }, { status: 400 });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(loanGroupDefaultWitnesses)
        .where(eq(loanGroupDefaultWitnesses.groupId, groupId));
      if (selected.length === 0) return;
      await tx.insert(loanGroupDefaultWitnesses).values(
        selected.map((row, index) => ({
          groupId,
          witnessId: row.witnessId,
          autoSign: row.autoSign,
          position: index,
        })),
      );
    });

    const rows = await db
      .select({
        id: witnesses.id,
        name: witnesses.name,
        email: witnesses.email,
        address: witnesses.address,
        validIdUrl: witnesses.validIdUrl,
        eSignatureUrl: witnesses.eSignatureUrl,
        autoSign: loanGroupDefaultWitnesses.autoSign,
      })
      .from(loanGroupDefaultWitnesses)
      .innerJoin(
        witnesses,
        eq(witnesses.id, loanGroupDefaultWitnesses.witnessId),
      )
      .where(eq(loanGroupDefaultWitnesses.groupId, groupId))
      .orderBy(asc(loanGroupDefaultWitnesses.position));

    return json({ witnesses: rows });
  } catch (error) {
    console.error("Error saving default witnesses:", error);
    return json({ error: "Failed to save witnesses" }, { status: 500 });
  }
};
