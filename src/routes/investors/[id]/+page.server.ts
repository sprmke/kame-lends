import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { investors, loans } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireUserSession } from '$lib/server/request-auth';

async function fetchOne(id: number, userId: string) {
	return db.query.investors.findFirst({
		where: and(eq(investors.id, id), eq(investors.userId, userId)),
		with: {
			loanInvestors: { with: { loan: true } },
			transactions: {
				orderBy: (transactions, { desc }) => [desc(transactions.date)]
			},
			debts: {
				orderBy: (debts, { desc }) => [desc(debts.date)],
				with: {
					interestPeriods: {
						with: { receivedPayments: true },
						orderBy: (periods, { asc }) => [asc(periods.periodNumber)]
					}
				}
			}
		}
	});
}

async function fetchInvestorLoans(loanIds: number[]) {
	if (loanIds.length === 0) return [];
	return db.query.loans.findMany({
		where: inArray(loans.id, loanIds),
		with: {
			borrower: true,
			loanInvestors: {
				with: {
					investor: true,
					interestPeriods: true,
					receivedPayments: true
				}
			}
		}
	});
}

export const load: PageServerLoad = async (event) => {
	const session = requireUserSession(event);
	const id = Number(event.params.id);
	if (Number.isNaN(id)) throw error(400, 'Invalid id');

	const entity = await fetchOne(id, session.user.id);
	if (!entity) throw error(404, 'Not found');

	const investorLoanIds = [...new Set(entity.loanInvestors.map((li) => li.loanId))];
	const loans = await fetchInvestorLoans(investorLoanIds);

	return { entity, loans };
};
