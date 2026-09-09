import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { debts } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '$lib/server/session';
import { hasDebtAccess } from '$lib/server/access-control';
import { parseDebtBody } from '$lib/debt-api';
import {
	markOverdueDebtInterestPeriods,
	syncDebtInterestPeriods
} from '$lib/server/debt-interest-period-sync';
import { invalidateDebtData } from '$lib/server/cache-invalidation';

export const GET: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: paramId } = await params;
		const id = parseInt(paramId);

		const hasAccess = await hasDebtAccess(id, session.user.id);
		if (!hasAccess) {
			return json({ error: 'Borrowing not found' }, { status: 404 });
		}

		const debt = await db.query.debts.findFirst({
			where: eq(debts.id, id),
			with: {
				investor: true,
				interestPeriods: {
					with: { receivedPayments: true },
					orderBy: (periods, { asc }) => [asc(periods.periodNumber)]
				}
			}
		});

		if (!debt) {
			return json({ error: 'Borrowing not found' }, { status: 404 });
		}

		if (!debt.interestPeriods?.length) {
			await syncDebtInterestPeriods(id);
		} else {
			await markOverdueDebtInterestPeriods(id);
		}

		const debtWithPeriods = await db.query.debts.findFirst({
			where: eq(debts.id, id),
			with: {
				investor: true,
				interestPeriods: {
					with: { receivedPayments: true },
					orderBy: (periods, { asc }) => [asc(periods.periodNumber)]
				}
			}
		});

		return json(debtWithPeriods);
	} catch (error) {
		console.error('Error fetching debt:', error);
		return json({ error: 'Failed to fetch borrowing' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: paramId } = await params;
		const id = parseInt(paramId);
		const body = await request.json();

		const hasAccess = await hasDebtAccess(id, session.user.id);
		if (!hasAccess) {
			return json({ error: 'Borrowing not found' }, { status: 404 });
		}

		const existingDebt = await db.query.debts.findFirst({
			where: eq(debts.id, id)
		});

		if (!existingDebt) {
			return json({ error: 'Borrowing not found' }, { status: 404 });
		}

		const debtData = {
			...parseDebtBody(body),
			updatedAt: new Date()
		};

		const updatedDebt = await db
			.update(debts)
			.set(debtData)
			.where(and(eq(debts.id, id), eq(debts.userId, session.user.id)))
			.returning();

		if (updatedDebt.length === 0) {
			return json({ error: 'Borrowing not found' }, { status: 404 });
		}

		await syncDebtInterestPeriods(id);

		const debtWithPeriods = await db.query.debts.findFirst({
			where: eq(debts.id, id),
			with: {
				investor: true,
				interestPeriods: {
					with: { receivedPayments: true },
					orderBy: (periods, { asc }) => [asc(periods.periodNumber)]
				}
			}
		});

		invalidateDebtData();
		return json(debtWithPeriods);
	} catch (error) {
		console.error('Error updating debt:', error);
		return json({ error: 'Failed to update borrowing' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: paramId } = await params;
		const id = parseInt(paramId);

		const hasAccess = await hasDebtAccess(id, session.user.id);
		if (!hasAccess) {
			return json({ error: 'Borrowing not found' }, { status: 404 });
		}

		const deletedDebt = await db.delete(debts).where(eq(debts.id, id)).returning();

		if (deletedDebt.length === 0) {
			return json({ error: 'Borrowing not found' }, { status: 404 });
		}

		invalidateDebtData();
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting debt:', error);
		return json({ error: 'Failed to delete borrowing' }, { status: 500 });
	}
};
