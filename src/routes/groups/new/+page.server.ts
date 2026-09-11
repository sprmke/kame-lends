import type { PageServerLoad } from "./$types";
import { requireUserSession } from "$lib/server/request-auth";

export const load: PageServerLoad = async (event) => {
  requireUserSession(event);
  return {};
};
