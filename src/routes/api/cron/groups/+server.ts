import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isCronAuthorized } from "$lib/server/cron-auth";
import { db } from "$lib/server/db";
import { loanGroups, groupNotificationLog } from "$lib/server/db/schema";
import { lt } from "drizzle-orm";
import { recomputeGroupMembers } from "$lib/server/group-access";
import {
  enqueueJob,
  pruneOldJobs,
  reclaimStuckJobs,
} from "$lib/server/jobs/queue";
import { drainJobs } from "$lib/server/jobs/runner";

export const config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ request }) => {
  if (!isCronAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const deadlineMs = 55_000;

  await reclaimStuckJobs();

  // 1) Reconcile members for all groups
  const groups = await db.select({ id: loanGroups.id }).from(loanGroups);
  for (const { id } of groups) {
    if (Date.now() - started > deadlineMs) break;
    await recomputeGroupMembers(id);
    await enqueueJob({
      kind: "group.calendar.acl",
      groupId: id,
      dedupeKey: `group.calendar.acl:${id}`,
    });
  }

  // 2) Telegram reminders / digest
  let telegram: unknown = null;
  try {
    const { manilaTodayKey } = await import("$lib/calendar-sync-plan");
    const { runGroupTelegramDailyReminders } =
      await import("$lib/server/telegram/group-notifications");
    telegram = await runGroupTelegramDailyReminders(manilaTodayKey());
  } catch (err) {
    console.error("[cron/groups] telegram reminders failed", err);
  }

  // 3) Drain jobs
  const drain = await drainJobs({
    maxJobs: 100,
    deadlineMs: Math.max(5_000, deadlineMs - (Date.now() - started)),
  });

  // 4) Prune
  const prunedJobs = await pruneOldJobs({ doneOlderThanDays: 14 });
  const notifCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const prunedNotifs = await db
    .delete(groupNotificationLog)
    .where(lt(groupNotificationLog.createdAt, notifCutoff))
    .returning();

  return json({
    ok: true,
    groups: groups.length,
    telegram,
    drain,
    prunedJobs,
    prunedNotifications: prunedNotifs.length,
    elapsedMs: Date.now() - started,
  });
};
