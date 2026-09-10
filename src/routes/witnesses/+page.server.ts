import type { PageServerLoad } from "./$types";
import { getCachedWitnesses } from "$lib/server/cached-data";
import { requireUserSession } from "$lib/server/request-auth";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  event.depends("app:witnesses");
  return { items: getCachedWitnesses(session.user.id, "list") };
};
