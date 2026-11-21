import { json, type RequestHandler } from "@sveltejs/kit";
import {
  emailNotificationKillSwitchState,
  isEmailNotificationsEnabled,
} from "$lib/server/email/index";
import { getSession } from "$lib/server/session";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  return json({
    ...emailNotificationKillSwitchState(),
    enabled: isEmailNotificationsEnabled(),
  });
};
