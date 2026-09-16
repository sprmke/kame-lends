import { db } from "$lib/server/db";
import { integrationJobs } from "$lib/server/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

export { jobBackoffMs } from "$lib/server/jobs/backoff";

export type IntegrationJobKind =
  | "group.members.recompute"
  | "group.calendar.provision"
  | "group.calendar.acl"
  | "group.calendar.syncLoan"
  | "group.calendar.removeLoan"
  | "group.calendar.summaries"
  | "group.calendar.delete"
  | "group.telegram.activity";

export type ActivityEvent = {
  type: string;
  entityId: string | number;
  updatedAt?: string;
  summary?: string;
  loanId?: number;
};

export async function enqueueJob(input: {
  kind: IntegrationJobKind | string;
  groupId?: number | null;
  payload?: Record<string, unknown>;
  dedupeKey?: string | null;
  runAfter?: Date;
}): Promise<{ id: number } | null> {
  const values = {
    kind: input.kind,
    groupId: input.groupId ?? null,
    payload: input.payload ?? {},
    dedupeKey: input.dedupeKey ?? null,
    runAfter: input.runAfter ?? new Date(),
    status: "pending" as const,
  };

  if (input.dedupeKey) {
    const inserted = await db
      .insert(integrationJobs)
      .values(values)
      .onConflictDoNothing()
      .returning();
    return inserted[0] ? { id: Number(inserted[0].id) } : null;
  }

  const inserted = await db.insert(integrationJobs).values(values).returning();
  return inserted[0] ? { id: Number(inserted[0].id) } : null;
}

/**
 * Single helper mutation routes call after loan changes that affect
 * group calendars / Telegram activity (not membership).
 */
export async function enqueueGroupLoanChanged(
  loanId: number,
  options: {
    calendar?: boolean;
    activity?: ActivityEvent;
  } = { calendar: true },
): Promise<void> {
  const { loanGroupLoans } = await import("$lib/server/db/schema");
  const rows = await db
    .select({ groupId: loanGroupLoans.groupId })
    .from(loanGroupLoans)
    .where(eq(loanGroupLoans.loanId, loanId));

  for (const { groupId } of rows) {
    if (options.calendar !== false) {
      await enqueueJob({
        kind: "group.calendar.syncLoan",
        groupId,
        payload: { loanId },
        dedupeKey: `group.calendar.syncLoan:${groupId}:${loanId}`,
      });
    }
    if (options.activity) {
      const updatedAt = options.activity.updatedAt ?? new Date().toISOString();
      await enqueueJob({
        kind: "group.telegram.activity",
        groupId,
        payload: { event: { ...options.activity, loanId, updatedAt } },
        dedupeKey: `group.telegram.activity:${groupId}:${options.activity.type}:${options.activity.entityId}:${updatedAt}`,
      });
    }
  }
}

export async function reclaimStuckJobs(
  olderThanMs = 10 * 60 * 1000,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const result = await db
    .update(integrationJobs)
    .set({
      status: "pending",
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrationJobs.status, "running"),
        sql`${integrationJobs.lockedAt} < ${cutoff}`,
      ),
    )
    .returning();
  return result.length;
}

export async function pruneOldJobs(options?: {
  doneOlderThanDays?: number;
}): Promise<number> {
  const days = options?.doneOlderThanDays ?? 14;
  const cutoff = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const result = await db
    .delete(integrationJobs)
    .where(
      and(
        inArray(integrationJobs.status, ["done", "failed"]),
        sql`${integrationJobs.updatedAt} < ${cutoff}`,
      ),
    )
    .returning();
  return result.length;
}
