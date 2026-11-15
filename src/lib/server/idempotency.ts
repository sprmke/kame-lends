/**
 * Idempotency for money-creating requests (DATA-09).
 *
 * The client sends `Idempotency-Key`. The first request runs and stores its
 * response for 24 hours. A retry with the same key returns the stored response
 * instead of creating a second loan or payment.
 */
import { and, eq, lt } from "drizzle-orm";
import { db } from "$lib/server/db";
import { idempotencyKeys } from "$lib/server/db/schema";

const TTL_MS = 24 * 60 * 60 * 1000;

export function idempotencyKeyOf(request: Request): string | null {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 200) return null;
  return key;
}

export async function findIdempotentResponse(
  key: string,
  userId: string,
  route: string,
): Promise<{ status: number; body: unknown } | null> {
  const row = await db.query.idempotencyKeys.findFirst({
    where: and(
      eq(idempotencyKeys.key, key),
      eq(idempotencyKeys.userId, userId),
      eq(idempotencyKeys.route, route),
    ),
  });
  if (!row) return null;
  const age = Date.now() - new Date(row.createdAt).getTime();
  if (age > TTL_MS) {
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    return null;
  }
  if (row.responseStatus == null) {
    // Another request with the same key is still running.
    return {
      status: 409,
      body: { error: "This request is already in progress." },
    };
  }
  return { status: row.responseStatus, body: row.responseBody };
}

/**
 * Claim a key before doing work. Returns true when this request owns the key.
 * A false result means a previous attempt exists (use
 * `findIdempotentResponse` to replay or report in-progress).
 */
export async function claimIdempotencyKey(
  key: string,
  userId: string,
  route: string,
): Promise<boolean> {
  const inserted = await db
    .insert(idempotencyKeys)
    .values({ key, userId, route })
    .onConflictDoNothing({ target: idempotencyKeys.key })
    .returning();
  return inserted.length > 0;
}

export async function rememberIdempotentResponse(
  key: string,
  userId: string,
  route: string,
  status: number,
  body: unknown,
): Promise<void> {
  await db
    .insert(idempotencyKeys)
    .values({
      key,
      userId,
      route,
      responseStatus: status,
      responseBody: body as never,
    })
    .onConflictDoUpdate({
      target: idempotencyKeys.key,
      set: {
        responseStatus: status,
        responseBody: body as never,
        updatedAt: new Date(),
      },
    });
}

/** Best-effort cleanup; called by the loop that already touches the table. */
export async function purgeExpiredIdempotencyKeys(): Promise<void> {
  await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, new Date(Date.now() - TTL_MS)));
}
