import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  loanGroups,
  loanGroupLoans,
  loanGroupRules,
  groupCalendars,
} from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { getCachedGroupsForUser } from "$lib/server/cached-data";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";
import { hasLoanAdminAccess } from "$lib/server/access-control";
import {
  recomputeGroupMembers,
  previewAccessForLoanIds,
} from "$lib/server/group-access";
import { createGroupBodySchema, parseJsonBody } from "$lib/group-validation";
import { enqueueJob } from "$lib/server/jobs/queue";
import { scheduleDrain } from "$lib/server/jobs/after-response";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await isWorkspaceAdmin(session.user.id);
    return json(await getCachedGroupsForUser(session.user.id, isAdmin));
  } catch (error) {
    console.error("Error fetching groups:", error);
    return json({ error: "Failed to fetch groups" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = parseJsonBody(
      createGroupBodySchema,
      await event.request.json(),
    );
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
    const description = body.description ?? body.notes ?? null;

    for (const loanId of body.loanIds) {
      if (!(await hasLoanAdminAccess(loanId, session.user.id))) {
        return json(
          { error: `Cannot group loan ${loanId}: not the owner` },
          { status: 403 },
        );
      }
    }

    const creatorUserId = session.user.id;
    const group = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(loanGroups)
        .values({
          creatorUserId,
          name: body.name,
          color: body.color ?? "orange",
          notes: description?.trim() || null,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to insert group");
      }

      if (body.loanIds.length > 0) {
        await tx.insert(loanGroupLoans).values(
          body.loanIds.map((loanId) => ({
            groupId: created.id,
            loanId,
            source: "manual" as const,
            addedByUserId: creatorUserId,
          })),
        );
      }

      if (body.rules.length > 0) {
        await tx.insert(loanGroupRules).values(
          body.rules.map((rule) => ({
            groupId: created.id,
            partyType: rule.partyType,
            contactId: rule.contactId,
            createdByUserId: creatorUserId,
          })),
        );
      }

      if (body.createCalendar) {
        await tx.insert(groupCalendars).values({
          groupId: created.id,
          status: "provisioning",
        });
      }

      return created;
    });

    await recomputeGroupMembers(group.id);
    const access = await previewAccessForLoanIds({
      existingLoanIds: [],
      addLoanIds: body.loanIds,
    });

    if (body.createCalendar) {
      await enqueueJob({
        kind: "group.calendar.provision",
        groupId: group.id,
        dedupeKey: `group.calendar.provision:${group.id}`,
      });
    }
    for (const loanId of body.loanIds) {
      await enqueueJob({
        kind: "group.calendar.syncLoan",
        groupId: group.id,
        payload: { loanId },
        dedupeKey: `group.calendar.syncLoan:${group.id}:${loanId}`,
      });
      await enqueueJob({
        kind: "group.telegram.activity",
        groupId: group.id,
        payload: {
          event: {
            type: "loan_added",
            entityId: loanId,
            loanId,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }

    invalidateGroupData();
    scheduleDrain(event);
    return json({ ...group, access }, { status: 201 });
  } catch (error) {
    console.error("Error creating group:", error);
    return json({ error: "Failed to create group" }, { status: 500 });
  }
};
