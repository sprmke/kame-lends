import { SvelteKitAuth } from "@auth/sveltekit";
import Google from "@auth/core/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { env } from "$env/dynamic/private";
import { normalizeEmail } from "$lib/loan-signing";
import { db } from "$lib/server/db";
import {
  findUserByNormalizedEmail,
  isGoogleSignInAllowed,
  workspaceHasUsers,
} from "$lib/server/auth-sign-in";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "$lib/server/db/schema";

export const { handle, signIn, signOut } = SvelteKitAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      // Party users are created by email before their first Google login.
      // Google verifies the address, so linking that existing row is safe.
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: normalizeEmail(profile.email) ?? profile.email,
          image: profile.picture,
        };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      const existing = await findUserByNormalizedEmail(user.email);
      return isGoogleSignInAllowed({
        email: user.email,
        existingUser: Boolean(existing),
        workspaceHasUsers: existing ? true : await workspaceHasUsers(),
      });
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Drizzle adapter returns the full user row; role is always on the table.
        (session.user as { role?: string }).role = (
          user as typeof users.$inferSelect
        ).role;
      }
      return session;
    },
  },
  secret: env.AUTH_SECRET,
  trustHost: true,
});
