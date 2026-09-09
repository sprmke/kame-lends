import type { PageServerLoad } from './$types';
import { getCachedInvestors } from '$lib/server/cached-data';
import { requireUserSession } from '$lib/server/request-auth';

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	event.depends('app:investors');
	return { items: getCachedInvestors(session.user.id, 'list') };
};
