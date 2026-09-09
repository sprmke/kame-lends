import type { PageServerLoad } from './$types';
import { requireUserSession } from '$lib/server/request-auth';
import { getNavCapabilities } from '$lib/server/access-control';
import { listPaymentMethodsForUser } from '$lib/server/payment-methods';

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	const navCapabilities = await getNavCapabilities(session.user.id);
	const paymentMethods = navCapabilities.isAdminWorkspace
		? await listPaymentMethodsForUser(session.user.id)
		: [];
	return {
		user: session.user,
		isAdminWorkspace: navCapabilities.isAdminWorkspace,
		paymentMethods
	};
};
