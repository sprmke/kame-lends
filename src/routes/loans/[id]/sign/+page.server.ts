import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUserSession } from '$lib/server/request-auth';
import type { SigningPartyRole } from '$lib/loan-signing';
import { resolveAuthenticatedSigningPayload } from '$lib/server/loan-signing-server';

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	const loanId = Number(event.params.id);
	if (Number.isNaN(loanId)) throw error(400, 'Invalid id');

	const preferredRole = event.url.searchParams.get('role') as SigningPartyRole | null;
	const result = await resolveAuthenticatedSigningPayload({
		loanId,
		userId: session.user.id,
		sessionEmail: session.user.email,
		preferredRole
	});

	if ('error' in result && result.error === 'not_found') {
		throw error(404, 'Not found');
	}
	if ('error' in result && result.error === 'no_slot') {
		throw error(403, 'No signature slot for this account on this loan');
	}

	return {
		loanId,
		signing: result.payload
	};
};
