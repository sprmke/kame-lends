import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { z } from "zod";
import { getSession } from "$lib/server/session";
import { isSameOriginRequest } from "$lib/server/same-origin";
import { setMessageFeedback } from "$lib/server/ai/assistant/store";

const schema = z
  .object({
    messageId: z.string().uuid(),
    value: z.union([z.literal(1), z.literal(-1)]),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const POST: RequestHandler = async (event) => {
  if (!isSameOriginRequest(event.request, event.url)) {
    return json({ error: "Invalid origin" }, { status: 403 });
  }
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await event.request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Invalid request" }, { status: 400 });
  }
  const ok = await setMessageFeedback(
    session.user.id,
    parsed.data.messageId,
    parsed.data.value,
    parsed.data.reason,
  );
  return ok
    ? json({ ok: true })
    : json({ error: "Not found" }, { status: 404 });
};
