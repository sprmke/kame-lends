import { signIn } from "$lib/server/auth";
import { signInErrorMessage } from "$lib/server/auth-sign-in";
import {
  createDevSession,
  isLocalDevLoginEnabled,
} from "$lib/server/dev-session";
import { error, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.session?.user) {
    throw redirect(303, url.searchParams.get("callbackUrl") ?? "/dashboard");
  }
  return {
    callbackUrl: url.searchParams.get("callbackUrl") ?? "/dashboard",
    error: signInErrorMessage(url.searchParams.get("error")),
    devLogin: isLocalDevLoginEnabled(),
  };
};

export const actions: Actions = {
  signIn,

  async devSignIn({ cookies, url }) {
    if (!isLocalDevLoginEnabled()) {
      throw error(404, "Not found");
    }
    const { sessionToken } = await createDevSession();
    cookies.set("authjs.session-token", sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });
    throw redirect(303, url.searchParams.get("callbackUrl") ?? "/dashboard");
  },
};
