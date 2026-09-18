import { json, type RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { pushSubscriptions } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { and, eq } from "drizzle-orm";

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await event.request.json()) as { endpoint?: string };
  if (!body.endpoint) {
    return json({ error: "Missing endpoint" }, { status: 400 });
  }

  await db
    .update(pushSubscriptions)
    .set({ disabledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(pushSubscriptions.endpoint, body.endpoint),
        eq(pushSubscriptions.userId, session.user.id),
      ),
    );

  return json({ ok: true });
};
