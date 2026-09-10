import { signIn } from "$lib/server/auth";
import { signInErrorMessage } from "$lib/server/auth-sign-in";
import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.session?.user) {
    throw redirect(303, url.searchParams.get("callbackUrl") ?? "/dashboard");
  }
  return {
    callbackUrl: url.searchParams.get("callbackUrl") ?? "/dashboard",
    error: signInErrorMessage(url.searchParams.get("error")),
  };
};

export const actions: Actions = {
  signIn,
};
