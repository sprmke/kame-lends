import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Wizard replaces /groups/new. Keep deep links working. */
export const load: PageServerLoad = async () => {
  throw redirect(303, "/groups?create=1");
};
