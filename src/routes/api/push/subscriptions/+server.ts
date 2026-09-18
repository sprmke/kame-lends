import { json, type RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { pushSubscriptions } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { and, eq, isNull } from "drizzle-orm";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.query.pushSubscriptions.findMany({
    where: and(
      eq(pushSubscriptions.userId, session.user.id),
      isNull(pushSubscriptions.disabledAt),
    ),
    columns: {
      id: true,
      deviceLabel: true,
      userAgent: true,
      lastSuccessAt: true,
      createdAt: true,
    },
  });

  return json({ subscriptions: rows });
};
