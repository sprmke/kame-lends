import type { RequestEvent } from '@sveltejs/kit';

export async function getSession(event: RequestEvent) {
	return event.locals.session ?? (await event.locals.auth?.()) ?? null;
}

export async function requireSession(event: RequestEvent) {
	const session = await getSession(event);
	if (!session?.user?.id) {
		return null;
	}
	return session;
}
