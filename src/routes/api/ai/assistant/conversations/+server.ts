import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { isSameOriginRequest } from "$lib/server/same-origin";
import {
  AssistantStoreUnavailable,
  deleteAllConversations,
  listConversations,
} from "$lib/server/ai/assistant/store";

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) return unauthorized();
  const query = event.url.searchParams.get("q")?.slice(0, 80) || undefined;
  const beforeRaw = event.url.searchParams.get("before");
  const before = beforeRaw ? new Date(beforeRaw) : undefined;
  try {
    const conversations = await listConversations(session.user.id, {
      query,
      before: before && !Number.isNaN(before.getTime()) ? before : undefined,
      limit: 30,
    });
    return json(
      { conversations },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AssistantStoreUnavailable) {
      return json({ conversations: [], unavailable: true });
    }
    throw error;
  }
};

export const DELETE: RequestHandler = async (event) => {
  if (!isSameOriginRequest(event.request, event.url)) {
    return json({ error: "Invalid origin" }, { status: 403 });
  }
  const session = await getSession(event);
  if (!session?.user?.id) return unauthorized();
  const deleted = await deleteAllConversations(session.user.id);
  return json({ deleted });
};
