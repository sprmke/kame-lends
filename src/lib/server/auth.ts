import { SvelteKitAuth } from "@auth/sveltekit";
import Google from "@auth/core/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
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
import {
  enforceWorkspaceOwnerRole,
  isWorkspaceOwnerEmail,
} from "$lib/server/workspace-owner";

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
      const allowed = isGoogleSignInAllowed({
        email: user.email,
        existingUser: Boolean(existing),
        workspaceHasUsers: existing ? true : await workspaceHasUsers(),
      });
      if (allowed && user.id) {
        await enforceWorkspaceOwnerRole(user.id);
      }
      return allowed;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const row = user as typeof users.$inferSelect;
        (session.user as { role?: string | null }).role = row.role ?? null;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (isWorkspaceOwnerEmail(user.email) && user.id) {
        await db
          .update(users)
          .set({ role: "admin" })
          .where(eq(users.id, user.id));
      }
    },
  },
  secret: env.AUTH_SECRET,
  trustHost: true,
});
