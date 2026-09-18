import { json, type RequestHandler } from "@sveltejs/kit";
import { APP_NAME } from "$lib/brand";
import { sendPushToUser } from "$lib/server/push/web-push";
import { getSession } from "$lib/server/session";

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const fingerprint = `test:${session.user.id}:${Date.now()}`;
  const outcome = await sendPushToUser(
    session.user.id,
    {
      title: APP_NAME,
      body: "Test notification",
      path: "/settings",
      tag: fingerprint,
    },
    { fingerprint, kind: "test" },
  );

  return json(outcome);
};
