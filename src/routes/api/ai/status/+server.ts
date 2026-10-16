import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { getAiStatus } from "$lib/server/ai/config";

/** Which AI features the UI may offer. No keys, limits, or provider details. */
export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return json(getAiStatus(), {
    headers: { "Cache-Control": "private, max-age=60" },
  });
};
