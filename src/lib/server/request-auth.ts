import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Session } from '@auth/core/types';

type AuthenticatedSession = Session & {
	user: NonNullable<Session['user']> & {
		id: string;
		role?: 'admin' | 'investor' | string;
	};
};

/** Session resolved once per request in hooks.server.ts. */
export function getRequestSession(event: RequestEvent): Session | null {
	return event.locals.session;
}

export function requireUserSession(event: RequestEvent): AuthenticatedSession {
	const session = event.locals.session;
	if (!session?.user?.id) throw redirect(303, '/signin');
	return session as AuthenticatedSession;
}
