import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { borrowers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '$lib/server/session';
import { normalizeValidIdUrl, normalizeSignatureImageUrl } from '$lib/valid-id-document';
import { invalidateBorrowerData } from '$lib/server/cache-invalidation';
import { findOrCreatePartyUser } from '$lib/server/party-user';

interface RouteParams {
	params: Promise<{ id: string }>;
}

export const GET: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = params;
		const borrowerId = parseInt(id, 10);
		if (Number.isNaN(borrowerId)) {
			return json({ error: 'Invalid borrower ID' }, { status: 400 });
		}

		const borrower = await db.query.borrowers.findFirst({
			where: and(eq(borrowers.id, borrowerId), eq(borrowers.userId, session.user.id)),
			with: {
				loans: {
					columns: { id: true }
				}
			}
		});

		if (!borrower) {
			return json({ error: 'Borrower not found' }, { status: 404 });
		}

		return json(borrower);
	} catch (error) {
		console.error('Error fetching borrower:', error);
		return json({ error: 'Failed to fetch borrower' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = params;
		const borrowerId = parseInt(id, 10);
		if (Number.isNaN(borrowerId)) {
			return json({ error: 'Invalid borrower ID' }, { status: 400 });
		}

		const existingBorrower = await db.query.borrowers.findFirst({
			where: and(eq(borrowers.id, borrowerId), eq(borrowers.userId, session.user.id))
		});

		if (!existingBorrower) {
			return json({ error: 'Borrower not found' }, { status: 404 });
		}

		const body = await request.json();

		if (!body.name?.trim()) {
			return json({ error: 'Borrower name is required' }, { status: 400 });
		}

		const email = typeof body.email === 'string' ? body.email.trim() : '';
		const partyUser = email
			? await findOrCreatePartyUser({
					email,
					name: body.name,
					role: 'borrower'
				})
			: null;

		const updatedBorrower = await db
			.update(borrowers)
			.set({
				name: body.name.trim(),
				contactNumber: body.contactNumber || null,
				email: email || null,
				address: body.address || null,
				notes: body.notes || null,
				validIdUrl: normalizeValidIdUrl(body.validIdUrl),
				eSignatureUrl: normalizeSignatureImageUrl(body.eSignatureUrl),
				borrowerUserId: partyUser?.id ?? null,
				updatedAt: new Date()
			})
			.where(and(eq(borrowers.id, borrowerId), eq(borrowers.userId, session.user.id)))
			.returning();

		invalidateBorrowerData();
		return json(updatedBorrower[0]);
	} catch (error) {
		console.error('Error updating borrower:', error);
		return json({ error: 'Failed to update borrower' }, { status: 500 });
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
		const borrowerId = parseInt(id, 10);
		if (Number.isNaN(borrowerId)) {
			return json({ error: 'Invalid borrower ID' }, { status: 400 });
		}

		const borrower = await db.query.borrowers.findFirst({
			where: and(eq(borrowers.id, borrowerId), eq(borrowers.userId, session.user.id)),
			with: {
				loans: {
					columns: { id: true }
				}
			}
		});

		if (!borrower) {
			return json({ error: 'Borrower not found' }, { status: 404 });
		}

		if (borrower.loans.length > 0) {
			return json(
				{
					error: 'Cannot delete borrower with existing loans',
					details: `This borrower has ${borrower.loans.length} loan(s)`
				},
				{ status: 400 }
			);
		}

		await db
			.delete(borrowers)
			.where(and(eq(borrowers.id, borrowerId), eq(borrowers.userId, session.user.id)));

		invalidateBorrowerData();
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting borrower:', error);
		return json({ error: 'Failed to delete borrower' }, { status: 500 });
	}
};
