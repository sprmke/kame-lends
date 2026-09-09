import type { LayoutServerLoad } from './$types';
import { getNavCapabilities } from '$lib/server/access-control';

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = locals.session;
	const navCapabilities = session?.user?.id
		? await getNavCapabilities(session.user.id)
		: {
				isAdminWorkspace: false,
				hasInvestments: false,
				hasBorrowed: false,
				hasWitnessed: false
			};

	return { session, navCapabilities };
};
