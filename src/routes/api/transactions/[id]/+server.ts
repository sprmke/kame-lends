import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '$lib/server/session';
import { hasTransactionAccess } from '$lib/server/access-control';
import { invalidateTransactionData } from '$lib/server/cache-invalidation';

export const GET: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: paramId } = await params;
		const id = parseInt(paramId);

		// Check if user has access to this transaction
		const hasAccess = await hasTransactionAccess(id, session.user.id);
		if (!hasAccess) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		const transaction = await db.query.transactions.findFirst({
			where: eq(transactions.id, id),
			with: {
				investor: true
			}
		});

		if (!transaction) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		return json(transaction);
	} catch (error) {
		console.error('Error fetching transaction:', error);
		return json({ error: 'Failed to fetch transaction' }, { status: 500 });
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

		// Check if user has access to this transaction
		const hasAccess = await hasTransactionAccess(id, session.user.id);
		if (!hasAccess) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		// Check if transaction exists and get its type
		const existingTransaction = await db.query.transactions.findFirst({
			where: eq(transactions.id, id)
		});

		if (!existingTransaction) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		// Remove balance from body if present (balance should never be editable)
		const { balance, ...updateData } = body;

		// Convert ISO string date to Date object for Drizzle
		const transactionData = {
			...updateData,
			date: new Date(updateData.date),
			updatedAt: new Date()
		};

		const updatedTransaction = await db
			.update(transactions)
			.set(transactionData)
			.where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)))
			.returning();

		if (updatedTransaction.length === 0) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		invalidateTransactionData();
		return json(updatedTransaction[0]);
	} catch (error) {
		console.error('Error updating transaction:', error);
		return json({ error: 'Failed to update transaction' }, { status: 500 });
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

		// Check if user has access to this transaction
		const hasAccess = await hasTransactionAccess(id, session.user.id);
		if (!hasAccess) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		// Get transaction details before deletion
		const transactionToDelete = await db.query.transactions.findFirst({
			where: eq(transactions.id, id)
		});

		if (!transactionToDelete) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		const deletedTransaction = await db
			.delete(transactions)
			.where(eq(transactions.id, id))
			.returning();

		if (deletedTransaction.length === 0) {
			return json({ error: 'Transaction not found' }, { status: 404 });
		}

		invalidateTransactionData();
		return json({ success: true });
	} catch (error) {
		console.error('Error deleting transaction:', error);
		return json({ error: 'Failed to delete transaction' }, { status: 500 });
	}
};
