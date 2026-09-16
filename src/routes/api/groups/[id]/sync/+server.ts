import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { hasGroupManageAccess } from "$lib/server/group-access";
import { enqueueJob } from "$lib/server/jobs/queue";
import { scheduleDrain } from "$lib/server/jobs/after-response";
import { drainJobs } from "$lib/server/jobs/runner";

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const groupId = parseInt(event.params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    await enqueueJob({
      kind: "group.members.recompute",
      groupId,
      dedupeKey: `group.members.recompute:${groupId}`,
    });
    await enqueueJob({
      kind: "group.calendar.acl",
      groupId,
      dedupeKey: `group.calendar.acl:${groupId}`,
    });
    await enqueueJob({
      kind: "group.calendar.provision",
      groupId,
      dedupeKey: `group.calendar.provision:${groupId}`,
    });

    scheduleDrain(event);
    const result = await drainJobs({ maxJobs: 20, deadlineMs: 20_000 });
    return json({ success: true, ...result });
  } catch (error) {
    console.error("Error syncing group:", error);
    return json({ error: "Failed to sync group" }, { status: 500 });
  }
};
