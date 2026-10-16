import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { hasGroupViewAccess } from "$lib/server/group-access";
import { uniqueDefaultWitnesses } from "$lib/groups/default-witnesses";
import { loadDefaultWitnessesForGroups } from "$lib/server/groups/apply-default-witnesses";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const ids = [
      ...new Set(
        (event.url.searchParams.get("ids") ?? "")
          .split(",")
          .map((value) => Number(value))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ].slice(0, 50);

    const allowed: number[] = [];
    for (const groupId of ids) {
      if (await hasGroupViewAccess(groupId, session.user.id)) {
        allowed.push(groupId);
      }
    }

    const rows = await loadDefaultWitnessesForGroups(allowed);
    return json({ witnesses: uniqueDefaultWitnesses(rows) });
  } catch (error) {
    console.error("Error loading group default witnesses:", error);
    return json({ error: "Failed to load witnesses" }, { status: 500 });
  }
};
