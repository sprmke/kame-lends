import type { TelegramActivityDetail } from "$lib/groups/telegram-message-context";
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
  | "group.telegram.activity"
  | "push.user.activity";

export type ActivityEvent = {
  type: string;
  entityId: string | number;
  updatedAt?: string;
  summary?: string;
  loanId?: number;
  /** The signed-in user who performed the action. Never emailed. */
  actorUserId?: string;
  /** Actor email fallback for party rows without a linked user. */
  actorEmail?: string;
  detail?: TelegramActivityDetail;
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

  if (options.activity) {
    const updatedAt = options.activity.updatedAt ?? new Date().toISOString();
    const event = { ...options.activity, loanId, updatedAt };
    // Email is loan-scoped: every party gets activity mail even when the loan
    // is not in any group.
    await enqueueJob({
      kind: "email.loan.activity",
      payload: { event },
      dedupeKey: `email.loan.activity:${event.type}:${event.entityId}:${updatedAt}`,
    });
  }

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
      const event = { ...options.activity, loanId, updatedAt };
      await enqueueJob({
        kind: "group.telegram.activity",
        groupId,
        payload: { event },
        dedupeKey: `group.telegram.activity:${groupId}:${options.activity.type}:${options.activity.entityId}:${updatedAt}`,
      });
      await enqueueJob({
        kind: "push.user.activity",
        groupId,
        payload: { event },
        dedupeKey: `push.user.activity:${groupId}:${options.activity.type}:${options.activity.entityId}:${updatedAt}`,
      });
    }
  }
}

/**
 * Group membership email. Separate from enqueueGroupLoanChanged because the
 * recipients are the group members, not only the loan parties, and the event
 * applies to one group at a time.
 */
export async function enqueueGroupLoanActivityEmails(input: {
  groupId: number;
  groupName: string;
  loanId: number;
  type: "loan_added" | "loan_removed";
  actorUserId?: string | null;
  actorEmail?: string | null;
  updatedAt?: string;
}): Promise<void> {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const event: ActivityEvent = {
    type: input.type,
    entityId: input.loanId,
    loanId: input.loanId,
    updatedAt,
    actorUserId: input.actorUserId ?? undefined,
    actorEmail: input.actorEmail ?? undefined,
  };

  await enqueueJob({
    kind: "email.group.loanActivity",
    groupId: input.groupId,
    payload: { event, groupName: input.groupName },
    dedupeKey: `email.group.loanActivity:${input.groupId}:${input.type}:${input.loanId}:${updatedAt}`,
  });

  await enqueueJob({
    kind: "push.user.activity",
    groupId: input.groupId,
    payload: { event },
    dedupeKey: `push.user.activity:${input.groupId}:${input.type}:${input.loanId}:${updatedAt}`,
  });
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
