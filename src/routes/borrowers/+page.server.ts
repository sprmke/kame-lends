import type { PageServerLoad } from "./$types";
import { getCachedBorrowers } from "$lib/server/cached-data";
import { requireUserSession } from "$lib/server/request-auth";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  event.depends("app:borrowers");
  return { items: getCachedBorrowers(session.user.id, "list") };
};
