import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { investors } from '$lib/server/db/schema';
import { getSession } from '$lib/server/session';
import { normalizeValidIdUrl, normalizeSignatureImageUrl } from '$lib/valid-id-document';
import { getCachedInvestors } from '$lib/server/cached-data';
import { invalidateInvestorData } from '$lib/server/cache-invalidation';
import { findOrCreatePartyUser } from '$lib/server/party-user';

export const GET: RequestHandler = async (event) => {
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const simple = event.url.searchParams.get('simple') === 'true';
		return json(await getCachedInvestors(session.user.id, simple));
	} catch (error) {
		console.error('Error fetching investors:', error);
		return json({ error: 'Failed to fetch investors' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await event.request.json();
		if (!body.email?.trim()) {
			return json({ error: 'Investor email is required' }, { status: 400 });
		}

		const investorUser = await findOrCreatePartyUser({
			email: body.email,
			name: body.name,
			role: 'investor'
		});
		if (!investorUser) {
			return json({ error: 'Investor email is required' }, { status: 400 });
		}

		const newInvestor = await db
			.insert(investors)
			.values({
				name: body.name,
				email: body.email,
				contactNumber: body.contactNumber || null,
				address: body.address || null,
				validIdUrl: normalizeValidIdUrl(body.validIdUrl),
				eSignatureUrl: normalizeSignatureImageUrl(body.eSignatureUrl),
				userId: session.user.id,
				investorUserId: investorUser.id
			})
			.returning();
		invalidateInvestorData();
		return json(newInvestor[0], { status: 201 });
	} catch (error) {
		console.error('Error creating investor:', error);
		return json({ error: 'Failed to create investor' }, { status: 500 });
	}
};
