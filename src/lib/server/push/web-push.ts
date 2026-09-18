import { db } from "$lib/server/db";
import { pushNotificationLog, pushSubscriptions } from "$lib/server/db/schema";
import { pushDeliveryAction } from "$lib/server/push/status";
import { ensureWebPushConfigured, webpush } from "$lib/server/push/vapid";
import { and, eq, isNull } from "drizzle-orm";

const MAX_FAILURES = 5;

export type PushPayload = {
  title: string;
  body: string;
  path?: string;
  tag?: string;
  badgeCount?: number;
};

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  meta: { fingerprint: string; kind: string },
): Promise<{
  sent: number;
  skipped?: boolean;
  failed: number;
  pruned: number;
}> {
  const result = { sent: 0, failed: 0, pruned: 0, skipped: false };

  if (!ensureWebPushConfigured()) {
    return { ...result, skipped: true };
  }

  const inserted = await db
    .insert(pushNotificationLog)
    .values({
      userId,
      fingerprint: meta.fingerprint,
      kind: meta.kind,
      status: "claimed",
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted[0]) {
    return { ...result, skipped: true };
  }
  const logId = inserted[0].id;

  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.userId, userId),
      isNull(pushSubscriptions.disabledAt),
    ),
  });

  if (subscriptions.length === 0) {
    await db
      .update(pushNotificationLog)
      .set({ status: "failed", error: "No active subscriptions" })
      .where(eq(pushNotificationLog.id, logId));
    return result;
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    path: payload.path ?? "/dashboard",
    tag: payload.tag ?? meta.fingerprint,
    badgeCount: payload.badgeCount,
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      );
      await db
        .update(pushSubscriptions)
        .set({
          failureCount: 0,
          lastSuccessAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, sub.id));
      result.sent += 1;
    } catch (err) {
      const statusCode =
        typeof err === "object" &&
        err !== null &&
        "statusCode" in err &&
        typeof (err as { statusCode: unknown }).statusCode === "number"
          ? (err as { statusCode: number }).statusCode
          : 500;
      const action = pushDeliveryAction(statusCode);

      if (action === "prune") {
        await db
          .update(pushSubscriptions)
          .set({ disabledAt: new Date(), updatedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
        result.pruned += 1;
      } else if (action === "retry") {
        const failures = sub.failureCount + 1;
        await db
          .update(pushSubscriptions)
          .set({
            failureCount: failures,
            disabledAt: failures >= MAX_FAILURES ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(pushSubscriptions.id, sub.id));
        result.failed += 1;
      } else {
        result.failed += 1;
      }
    }
  }

  const now = new Date();
  await db
    .update(pushNotificationLog)
    .set({
      status: result.sent > 0 ? "sent" : "failed",
      sentAt: result.sent > 0 ? now : null,
      error: result.sent > 0 ? null : "No subscriptions delivered",
    })
    .where(eq(pushNotificationLog.id, logId));

  return result;
}
