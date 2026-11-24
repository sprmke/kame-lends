import { json, type RequestHandler } from "@sveltejs/kit";
import { parseEmailPreferencesPatch } from "$lib/schemas/email-preferences";
import {
  getUserEmailPreferences,
  updateUserEmailPreferences,
} from "$lib/server/email/preferences";
import { getSession } from "$lib/server/session";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  return json(await getUserEmailPreferences(session.user.id));
};

export const PUT: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await event.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseEmailPreferencesPatch(body);
  if ("error" in parsed) {
    return json({ error: parsed.error }, { status: 400 });
  }

  const updated = await updateUserEmailPreferences(
    session.user.id,
    parsed.data,
  );
  return json(updated);
};
