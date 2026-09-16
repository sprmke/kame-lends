import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroups, groupCalendars } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import {
  hasGroupViewAccess,
  hasGroupManageAccess,
} from "$lib/server/group-access";
import { parseJsonBody, updateGroupBodySchema } from "$lib/group-validation";
import { enqueueJob } from "$lib/server/jobs/queue";
import { scheduleDrain } from "$lib/server/jobs/after-response";

export const GET: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    if (!(await hasGroupViewAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const canManage = await hasGroupManageAccess(groupId, session.user.id);

    const group = await db.query.loanGroups.findFirst({
      where: eq(loanGroups.id, groupId),
      with: {
        creator: { columns: { id: true, name: true, email: true } },
        groupLoans: {
          columns: { loanId: true, source: true, addedByUserId: true },
        },
        members: {
          columns: { userId: true, partyRoles: true },
          with: { user: { columns: { id: true, name: true, email: true } } },
        },
        rules: true,
        calendar: true,
        telegram: true,
      },
    });

    if (!group) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    if (!canManage) {
      return json({
        ...group,
        creator: group.creator
          ? { ...group.creator, email: null }
          : group.creator,
        members: group.members.map((member) => ({
          ...member,
          user: member.user ? { ...member.user, email: null } : member.user,
        })),
        telegram: group.telegram
          ? {
              ...group.telegram,
              chatId: null,
              linkedByUserId: null,
              lastError: null,
            }
          : group.telegram,
      });
    }

    return json(group);
  } catch (error) {
    console.error("Error fetching group:", error);
    return json({ error: "Failed to fetch group" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const parsed = parseJsonBody(updateGroupBodySchema, await request.json());
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
    if (
      !body.name &&
      !body.color &&
      body.description === undefined &&
      body.notes === undefined
    ) {
      return json({ error: "No changes" }, { status: 400 });
    }

    const description =
      body.description !== undefined
        ? body.description
        : body.notes !== undefined
          ? body.notes
          : undefined;

    const [updatedGroup] = await db
      .update(loanGroups)
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.color ? { color: body.color } : {}),
        ...(description !== undefined
          ? { notes: description?.trim() || null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(loanGroups.id, groupId))
      .returning();

    if (body.name) {
      // Rename calendar summary asynchronously
      await enqueueJob({
        kind: "group.calendar.provision",
        groupId,
        payload: { renameOnly: true },
        dedupeKey: `group.calendar.rename:${groupId}`,
      });
      scheduleDrain(event);
    }

    invalidateGroupData();
    return json(updatedGroup);
  } catch (error) {
    console.error("Error updating group:", error);
    return json({ error: "Failed to update group" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const calendar = await db.query.groupCalendars.findFirst({
      where: eq(groupCalendars.groupId, groupId),
    });
    const calendarId = calendar?.googleCalendarId ?? null;

    await db.delete(loanGroups).where(eq(loanGroups.id, groupId));

    if (calendarId) {
      await enqueueJob({
        kind: "group.calendar.delete",
        groupId,
        payload: { calendarId },
        dedupeKey: `group.calendar.delete:${calendarId}`,
      });
      scheduleDrain(event);
    }

    invalidateGroupData();
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting group:", error);
    return json({ error: "Failed to delete group" }, { status: 500 });
  }
};
