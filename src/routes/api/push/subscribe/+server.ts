import { json, type RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { pushSubscriptions } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { eq } from "drizzle-orm";

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await event.request.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
    deviceLabel?: string;
  };

  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return json({ error: "Invalid subscription" }, { status: 400 });
  }

  const now = new Date();
  await db
    .insert(pushSubscriptions)
    .values({
      userId: session.user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent ?? null,
      deviceLabel: body.deviceLabel ?? null,
      failureCount: 0,
      disabledAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: session.user.id,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: body.userAgent ?? null,
        deviceLabel: body.deviceLabel ?? null,
        failureCount: 0,
        disabledAt: null,
        updatedAt: now,
      },
    });

  return json({ ok: true });
};
