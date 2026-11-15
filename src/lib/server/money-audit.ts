/**
 * Append-only audit trail for money writes (DATA-07).
 *
 * Call this inside the same transaction as the money change. `before` and
 * `after` must contain only money-relevant fields, never receipts or PII.
 */
import { db } from "$lib/server/db";
import { moneyAuditEvents } from "$lib/server/db/schema";

type InsertClient = Pick<typeof db, "insert">;

export interface MoneyAuditInput {
  actorUserId?: string | null;
  entityType:
    | "loan"
    | "allocation"
    | "interest_period"
    | "received_payment"
    | "debt"
    | "debt_payment"
    | "repair";
  entityId?: number | null;
  loanId?: number | null;
  action:
    | "create"
    | "update"
    | "delete"
    | "restore"
    | "status"
    | "payment"
    | "revert"
    | "consolidate"
    | "repair";
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

export async function recordMoneyAudit(
  client: InsertClient,
  input: MoneyAuditInput,
): Promise<void> {
  await client.insert(moneyAuditEvents).values({
    actorUserId: input.actorUserId ?? null,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    loanId: input.loanId ?? null,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
  });
}
