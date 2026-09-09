import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/core/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { users, accounts, sessions, verificationTokens } from '$lib/server/db/schema';

function authSecret() {
	return env.AUTH_SECRET ?? '';
}

function googleId() {
	return env.AUTH_GOOGLE_ID ?? '';
}

function googleSecret() {
	return env.AUTH_GOOGLE_SECRET ?? '';
}

export const { handle, signIn, signOut } = SvelteKitAuth({
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens
	}),
	providers: [
		Google({
			clientId: googleId(),
			clientSecret: googleSecret()
		})
	],
	pages: {
		signIn: '/signin'
	},
	callbacks: {
		async session({ session, user }) {
			if (session.user) {
				session.user.id = user.id;
				// Drizzle adapter returns the full user row; role is always on the table.
				(session.user as { role?: string }).role = (user as typeof users.$inferSelect).role;
			}
			return session;
		}
	},
	secret: authSecret(),
	trustHost: true
});
