import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transactions } from '$lib/server/db/schema';
import { getSession } from '$lib/server/session';
import { getCachedTransactions } from '$lib/server/cached-data';
import { invalidateTransactionData } from '$lib/server/cache-invalidation';

export const GET: RequestHandler = async (event) => {
	const request = event.request;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const { searchParams } = new URL(request.url);
		const investorIdParam = searchParams.get('investorId');

		const investorId = investorIdParam ? parseInt(investorIdParam, 10) : null;
		return json(await getCachedTransactions(userId, investorId));
	} catch (error) {
		console.error('Error fetching transactions:', error);
		return json({ error: 'Failed to fetch transactions' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	const request = event.request;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const body = await request.json();

		// Convert ISO string date to Date object for Drizzle
		const transactionData = {
			...body,
			userId,
			date: new Date(body.date)
		};

		const newTransaction = await db.insert(transactions).values(transactionData).returning();

		invalidateTransactionData();
		return json(newTransaction[0], { status: 201 });
	} catch (error) {
		console.error('Error creating transaction:', error);
		return json({ error: 'Failed to create transaction' }, { status: 500 });
	}
};
