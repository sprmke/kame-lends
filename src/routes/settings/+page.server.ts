import type { PageServerLoad } from './$types';
import { requireUserSession } from '$lib/server/request-auth';
import { getNavCapabilities } from '$lib/server/access-control';

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	const navCapabilities = await getNavCapabilities(session.user.id);
	return {
		user: session.user,
		isAdminWorkspace: navCapabilities.isAdminWorkspace
	};
};
