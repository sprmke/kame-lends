import type { PageServerLoad } from './$types';
import { getCachedTransactions } from '$lib/server/cached-data';
import { requireUserSession } from '$lib/server/request-auth';

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	event.depends('app:transactions');
	return { items: getCachedTransactions(session.user.id, null) };
};
