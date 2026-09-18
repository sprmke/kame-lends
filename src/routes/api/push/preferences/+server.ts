import { json, type RequestHandler } from "@sveltejs/kit";
import {
  getUserPushPreferences,
  updateUserPushPreferences,
} from "$lib/server/push/preferences";
import { getSession } from "$lib/server/session";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  return json(await getUserPushPreferences(session.user.id));
};

export const PUT: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await event.request.json()) as Record<string, unknown>;
  const updated = await updateUserPushPreferences(session.user.id, {
    notifyUpcoming:
      typeof body.notifyUpcoming === "boolean"
        ? body.notifyUpcoming
        : undefined,
    reminderDays: Array.isArray(body.reminderDays)
      ? body.reminderDays.map(Number).filter(Number.isFinite)
      : undefined,
    notifyDueToday:
      typeof body.notifyDueToday === "boolean"
        ? body.notifyDueToday
        : undefined,
    notifyOverdue:
      typeof body.notifyOverdue === "boolean" ? body.notifyOverdue : undefined,
    notifyActivity:
      typeof body.notifyActivity === "boolean"
        ? body.notifyActivity
        : undefined,
    notifySigning:
      typeof body.notifySigning === "boolean" ? body.notifySigning : undefined,
  });

  return json(updated);
};
