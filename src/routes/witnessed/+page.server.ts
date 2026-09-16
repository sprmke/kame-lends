import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** @deprecated Use `/loans?scope=witnessed` */
export const load: PageServerLoad = () => {
  redirect(302, "/loans?scope=witnessed");
};
