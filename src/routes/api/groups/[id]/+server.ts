import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroups } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import {
  hasGroupViewAccess,
  hasGroupEditAccess,
} from "$lib/server/group-access";

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

    const group = await db.query.loanGroups.findFirst({
      where: eq(loanGroups.id, groupId),
      with: {
        creator: { columns: { id: true, name: true, email: true } },
        groupLoans: { columns: { loanId: true } },
        members: { columns: { userId: true, status: true } },
      },
    });

    if (!group) {
      return json({ error: "Group not found" }, { status: 404 });
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
    if (!(await hasGroupEditAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const body = await request.json();
    if (!body.name?.trim()) {
      return json({ error: "Group name is required" }, { status: 400 });
    }

    const [updatedGroup] = await db
      .update(loanGroups)
      .set({
        name: body.name.trim(),
        notes: body.notes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(loanGroups.id, groupId))
      .returning();

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
    if (!(await hasGroupEditAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    await db.delete(loanGroups).where(eq(loanGroups.id, groupId));

    invalidateGroupData();
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting group:", error);
    return json({ error: "Failed to delete group" }, { status: 500 });
  }
};
