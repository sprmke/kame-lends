import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { debtInterestPeriods, debtReceivedPayments } from '$lib/server/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { getSession } from '$lib/server/session';
import { invalidateDebtData } from '$lib/server/cache-invalidation';
import { hasDebtAccess } from '$lib/server/access-control';
import {
	DEBT_AMOUNT_TOLERANCE,
	recalculateDebtInterestPeriodStatus
} from '$lib/server/debt-interest-period-sync';

export const PATCH: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = params;
		const paymentId = parseInt(id, 10);
		if (!Number.isFinite(paymentId)) {
			return json({ error: 'Invalid id' }, { status: 400 });
		}

		const body = await request.json();
		const parsedAmount = parseFloat(String(body.amount ?? ''));
		const dateStr = String(body.receivedDate ?? '').trim();

		if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
			return json({ error: 'Enter a valid received amount greater than zero.' }, { status: 400 });
		}
		if (!dateStr) {
			return json({ error: 'Received date is required.' }, { status: 400 });
		}
		const receivedDateObj = new Date(dateStr);
		if (Number.isNaN(receivedDateObj.getTime())) {
			return json({ error: 'Invalid received date.' }, { status: 400 });
		}

		const payment = await db.query.debtReceivedPayments.findFirst({
			where: eq(debtReceivedPayments.id, paymentId),
			with: {
				debtInterestPeriod: {
					with: { debt: true }
				}
			}
		});

		if (!payment) {
			return json({ error: 'Received payment not found' }, { status: 404 });
		}

		const period = payment.debtInterestPeriod;
		const hasAccess = await hasDebtAccess(period.debtId, session.user.id);
		if (!hasAccess) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const others = await db.query.debtReceivedPayments.findMany({
			where: and(
				eq(debtReceivedPayments.debtInterestPeriodId, period.id),
				ne(debtReceivedPayments.id, paymentId)
			)
		});
		const otherSum = others.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
		const newTotal = otherSum + parsedAmount;
		const expectedAmount = parseFloat(period.expectedInterest) || 0;

		if (newTotal > expectedAmount + DEBT_AMOUNT_TOLERANCE) {
			return json(
				{
					error: `Amount would exceed the payment due for this period (${expectedAmount.toFixed(2)}). Maximum for this line: ${(expectedAmount - otherSum).toFixed(2)}.`
				},
				{ status: 400 }
			);
		}

		await db
			.update(debtReceivedPayments)
			.set({
				amount: String(parsedAmount),
				receivedDate: receivedDateObj,
				updatedAt: new Date()
			})
			.where(eq(debtReceivedPayments.id, paymentId));

		await recalculateDebtInterestPeriodStatus(period.id);

		invalidateDebtData();
		return json({ success: true });
	} catch (error) {
		console.error('Error updating debt received payment:', error);
		return json({ error: 'Failed to update received payment' }, { status: 500 });
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
		const paymentId = parseInt(id, 10);
		if (!Number.isFinite(paymentId)) {
			return json({ error: 'Invalid id' }, { status: 400 });
		}

		const payment = await db.query.debtReceivedPayments.findFirst({
			where: eq(debtReceivedPayments.id, paymentId),
			with: {
				debtInterestPeriod: {
					with: { debt: true }
				}
			}
		});

		if (!payment) {
			return json({ error: 'Received payment not found' }, { status: 404 });
		}

		const period = payment.debtInterestPeriod;
		const hasAccess = await hasDebtAccess(period.debtId, session.user.id);
		if (!hasAccess) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		await db.delete(debtReceivedPayments).where(eq(debtReceivedPayments.id, paymentId));

		await recalculateDebtInterestPeriodStatus(period.id);

		invalidateDebtData();
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting debt received payment:', error);
		return json({ error: 'Failed to delete received payment' }, { status: 500 });
	}
};
