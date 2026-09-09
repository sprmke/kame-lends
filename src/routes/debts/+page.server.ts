import type { PageServerLoad } from './$types';
import { getCachedDebts } from '$lib/server/cached-data';
import { requireUserSession } from '$lib/server/request-auth';

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	event.depends('app:debts');
	return { items: getCachedDebts(session.user.id, null) };
};
