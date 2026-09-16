import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { hasGroupManageAccess } from "$lib/server/group-access";
import { sendGroupTelegramTestMessage } from "$lib/server/telegram/group-notifications";

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseInt(event.params.id);
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const result = await sendGroupTelegramTestMessage(groupId);
    if (!result.ok) {
      return json({ error: result.error ?? "Send failed" }, { status: 502 });
    }

    return json({ success: true, messageIds: result.messageIds });
  } catch (error) {
    console.error("[telegram] test message", error);
    return json({ error: "Failed to send test message" }, { status: 500 });
  }
};
