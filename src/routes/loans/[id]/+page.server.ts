import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { loans } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getLoanAccessContext } from '$lib/server/access-control';
import { requireUserSession } from '$lib/server/request-auth';

async function fetchOne(id: number, userId: string) {
	const access = await getLoanAccessContext(id, userId);
	if (!access.canView) return null;
	const entity = await db.query.loans.findFirst({
		where: eq(loans.id, id),
		with: {
			borrower: true,
			loanInvestors: { with: { investor: true, interestPeriods: true, receivedPayments: true } },
			loanContract: true
		}
	});
	if (!entity) return null;
	return { entity, access };
}

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	const id = Number(event.params.id);
	if (Number.isNaN(id)) throw error(400, 'Invalid id');
	const result = await fetchOne(id, session.user.id);
	if (!result) throw error(404, 'Not found');

	if (event.url.searchParams.get('edit') === '1' && !result.access.canAdminEdit) {
		throw error(403, 'Read only');
	}

	return result;
};
