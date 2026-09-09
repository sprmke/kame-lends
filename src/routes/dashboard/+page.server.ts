import type { PageServerLoad } from './$types';
import { queryDashboardCharts, queryDashboardSummary } from '$lib/server/dashboard-data';
import { requireUserSession } from '$lib/server/request-auth';

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	event.depends('app:dashboard');
	const userId = session.user.id;
	return {
		summary: queryDashboardSummary(userId),
		charts: queryDashboardCharts(userId)
	};
};
