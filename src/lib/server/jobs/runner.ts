import { db } from "$lib/server/db";
import { integrationJobs } from "$lib/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { jobBackoffMs, reclaimStuckJobs } from "$lib/server/jobs/queue";

export type JobRow = typeof integrationJobs.$inferSelect;

type JobHandler = (job: JobRow) => Promise<void>;

const handlers: Record<string, JobHandler> = {};

export function registerJobHandler(kind: string, handler: JobHandler): void {
  handlers[kind] = handler;
}

async function ensureHandlersLoaded(): Promise<void> {
  if (Object.keys(handlers).length > 0) return;
  await import("$lib/server/jobs/handlers");
}

export async function drainJobs(options?: {
  maxJobs?: number;
  deadlineMs?: number;
}): Promise<{ processed: number; failed: number }> {
  await ensureHandlersLoaded();
  await reclaimStuckJobs();

  const maxJobs = options?.maxJobs ?? 25;
  const deadline = Date.now() + (options?.deadlineMs ?? 50_000);
  let processed = 0;
  let failed = 0;

  while (processed + failed < maxJobs && Date.now() < deadline) {
    const claimed = await claimJobs(1);
    if (claimed.length === 0) break;

    for (const job of claimed) {
      if (Date.now() >= deadline) {
        await db
          .update(integrationJobs)
          .set({
            status: "pending",
            lockedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(integrationJobs.id, job.id));
        continue;
      }

      const handler = handlers[job.kind];
      try {
        if (!handler) {
          throw new Error(`No handler for job kind: ${job.kind}`);
        }
        console.info(
          `[jobs] run ${job.kind} id=${job.id} group=${job.groupId}`,
        );
        await handler(job);
        await db
          .update(integrationJobs)
          .set({
            status: "done",
            lockedAt: null,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(integrationJobs.id, job.id));
        processed += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[jobs] fail ${job.kind} id=${job.id}`, message);
        const attempts = job.attempts;
        if (attempts >= 6) {
          await db
            .update(integrationJobs)
            .set({
              status: "failed",
              lastError: message,
              lockedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(integrationJobs.id, job.id));
          await writeIntegrationError(job, message);
        } else {
          await db
            .update(integrationJobs)
            .set({
              status: "pending",
              lastError: message,
              lockedAt: null,
              runAfter: new Date(Date.now() + jobBackoffMs(attempts)),
              updatedAt: new Date(),
            })
            .where(eq(integrationJobs.id, job.id));
        }
      }
    }
  }

  return { processed, failed };
}

async function claimJobs(limit: number): Promise<JobRow[]> {
  // Atomic claim with SKIP LOCKED
  const result = await db.execute(sql`
    UPDATE integration_jobs
    SET status = 'running',
        locked_at = now(),
        attempts = attempts + 1,
        updated_at = now()
    WHERE id IN (
      SELECT id FROM integration_jobs
      WHERE status = 'pending' AND run_after <= now()
      ORDER BY id
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING *
  `);

  const rows =
    (result as unknown as { rows?: JobRow[] }).rows ??
    (Array.isArray(result) ? (result as unknown as JobRow[]) : []);
  return rows.map(normalizeJobRow);
}

function normalizeJobRow(row: Record<string, unknown> | JobRow): JobRow {
  const r = row as Record<string, unknown>;
  return {
    id: Number(r.id),
    kind: String(r.kind),
    groupId:
      r.group_id != null
        ? Number(r.group_id)
        : r.groupId != null
          ? Number(r.groupId)
          : null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    dedupeKey: (r.dedupe_key ?? r.dedupeKey ?? null) as string | null,
    status: (r.status as JobRow["status"]) ?? "running",
    attempts: Number(r.attempts ?? 0),
    runAfter: new Date((r.run_after ?? r.runAfter) as string | Date),
    lockedAt:
      (r.locked_at ?? r.lockedAt)
        ? new Date((r.locked_at ?? r.lockedAt) as string | Date)
        : null,
    lastError: (r.last_error ?? r.lastError ?? null) as string | null,
    createdAt: new Date((r.created_at ?? r.createdAt) as string | Date),
    updatedAt: new Date((r.updated_at ?? r.updatedAt) as string | Date),
  };
}

async function writeIntegrationError(job: JobRow, message: string) {
  if (job.groupId == null) return;
  const { groupCalendars, groupTelegramSettings } =
    await import("$lib/server/db/schema");
  if (job.kind.startsWith("group.calendar")) {
    await db
      .update(groupCalendars)
      .set({ lastError: message, status: "error", updatedAt: new Date() })
      .where(eq(groupCalendars.groupId, job.groupId));
  }
  if (job.kind.startsWith("group.telegram")) {
    await db
      .update(groupTelegramSettings)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(groupTelegramSettings.groupId, job.groupId));
  }
}

export function jobBackoffMsForTests(attempts: number): number {
  return jobBackoffMs(attempts);
}
