import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { loanInvestors, loans } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSession } from '$lib/server/session';
import { invalidateLoanData } from '$lib/server/cache-invalidation';

export const POST: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = params;
		const loanId = parseInt(id);
		const { transactionId } = await request.json();

		if (isNaN(loanId) || !transactionId) {
			return json({ error: 'Invalid loan ID or transaction ID' }, { status: 400 });
		}

		// Verify loan ownership
		const loan = await db.query.loans.findFirst({
			where: and(eq(loans.id, loanId), eq(loans.userId, session.user.id))
		});

		if (!loan) {
			return json({ error: 'Loan not found' }, { status: 404 });
		}

		// Update the transaction's sent date to today and mark as paid
		await db
			.update(loanInvestors)
			.set({ sentDate: new Date(), isPaid: true })
			.where(and(eq(loanInvestors.id, transactionId), eq(loanInvestors.loanId, loanId)));

		// Fetch all transactions for this loan
		const allTransactions = await db
			.select()
			.from(loanInvestors)
			.where(eq(loanInvestors.loanId, loanId));

		// Check if there are any remaining unpaid transactions
		const unpaidTransactions = allTransactions.filter((transaction) => !transaction.isPaid);

		// If no unpaid transactions remain, update loan status to "Fully Funded"
		if (unpaidTransactions.length === 0) {
			await db.update(loans).set({ status: 'Fully Funded' }).where(eq(loans.id, loanId));
		}

		invalidateLoanData();
		return json({ success: true });
	} catch (error) {
		console.error('Error paying transaction:', error);
		return json({ error: 'Failed to pay transaction' }, { status: 500 });
	}
};
