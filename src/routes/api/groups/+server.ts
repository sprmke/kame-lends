import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loanGroups, loanGroupMembers } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { getCachedGroupsForUser } from "$lib/server/cached-data";
import { invalidateGroupData } from "$lib/server/cache-invalidation";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";

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

    const body = await event.request.json();
    if (!body.name?.trim()) {
      return json({ error: "Group name is required" }, { status: 400 });
    }

    const [newGroup] = await db
      .insert(loanGroups)
      .values({
        creatorUserId: session.user.id,
        name: body.name.trim(),
        notes: body.notes?.trim() || null,
      })
      .returning();

    await db.insert(loanGroupMembers).values({
      groupId: newGroup.id,
      userId: session.user.id,
      status: "active",
    });

    invalidateGroupData();
    return json(newGroup, { status: 201 });
  } catch (error) {
    console.error("Error creating group:", error);
    return json({ error: "Failed to create group" }, { status: 500 });
  }
};
