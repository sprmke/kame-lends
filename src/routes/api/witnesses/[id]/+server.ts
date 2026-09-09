import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { getSession } from '$lib/server/session';
import { db } from '$lib/server/db';
import { witnesses } from '$lib/server/db/schema';
import { invalidateWitnessData } from '$lib/server/cache-invalidation';
import { normalizeSignatureImageUrl, normalizeValidIdUrl } from '$lib/valid-id-document';
import { findOrCreatePartyUser } from '$lib/server/party-user';

interface RouteParams {
	params: Promise<{ id: string }>;
}

async function getOwnedWitness(id: number, userId: string) {
	return db.query.witnesses.findFirst({
		where: and(eq(witnesses.id, id), eq(witnesses.userId, userId))
	});
}

export const GET: RequestHandler = async (event) => {
	const { params, request } = event;
	const session = await getSession(event);
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { id } = params;
	const witnessId = Number.parseInt(id, 10);
	if (!Number.isFinite(witnessId)) {
		return json({ error: 'Invalid witness ID' }, { status: 400 });
	}

	const witness = await getOwnedWitness(witnessId, session.user.id);
	if (!witness) {
		return json({ error: 'Witness not found' }, { status: 404 });
	}
	return json(witness);
};

export const PUT: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = params;
		const witnessId = Number.parseInt(id, 10);
		if (!Number.isFinite(witnessId) || !(await getOwnedWitness(witnessId, session.user.id))) {
			return json({ error: 'Witness not found' }, { status: 404 });
		}

		const body = await request.json();
		if (!body.name?.trim()) {
			return json({ error: 'Witness name is required' }, { status: 400 });
		}

		const email = typeof body.email === 'string' ? body.email.trim() : '';
		const partyUser = email
			? await findOrCreatePartyUser({
					email,
					name: body.name,
					role: 'witness'
				})
			: null;

		const [updated] = await db
			.update(witnesses)
			.set({
				name: body.name.trim(),
				email: email || null,
				contactNumber: body.contactNumber?.trim() || null,
				address: body.address?.trim() || null,
				validIdUrl: normalizeValidIdUrl(body.validIdUrl),
				eSignatureUrl: normalizeSignatureImageUrl(body.eSignatureUrl),
				witnessUserId: partyUser?.id ?? null,
				updatedAt: new Date()
			})
			.where(and(eq(witnesses.id, witnessId), eq(witnesses.userId, session.user.id)))
			.returning();

		invalidateWitnessData();
		return json(updated);
	} catch (error) {
		console.error('Error updating witness:', error);
		return json({ error: 'Failed to update witness' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = params;
		const witnessId = Number.parseInt(id, 10);
		if (!Number.isFinite(witnessId) || !(await getOwnedWitness(witnessId, session.user.id))) {
			return json({ error: 'Witness not found' }, { status: 404 });
		}

		await db
			.delete(witnesses)
			.where(and(eq(witnesses.id, witnessId), eq(witnesses.userId, session.user.id)));

		invalidateWitnessData();
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting witness:', error);
		return json({ error: 'Failed to delete witness' }, { status: 500 });
	}
};
