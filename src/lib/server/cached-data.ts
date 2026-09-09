import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { remember } from '$lib/server/memory-cache';
import {
	borrowers,
	debts,
	investors,
	loanInvestors,
	loanSigningInvitations,
	loans,
	transactions,
	witnesses
} from '$lib/server/db/schema';

export type LoanCacheMode = 'full' | 'list';
export type InvestorCacheMode = 'simple' | 'list' | 'full';
export type LoanListScope = 'owned' | 'investments' | 'borrowed' | 'witnessed' | 'all';

const listRelations = {
	loanInvestors: {
		with: {
			investor: { columns: { id: true, name: true } },
			interestPeriods: {
				columns: { interestRate: true, interestType: true, dueDate: true }
			}
		}
	}
} as const;

const fullRelations = {
	borrower: true,
	loanInvestors: {
		with: {
			investor: true,
			interestPeriods: true,
			receivedPayments: true
		}
	}
} as const;

export async function getCachedLoans(userId: string, mode: LoanCacheMode = 'full') {
	const cacheKey = mode === 'list' ? `loans:list:${userId}` : `loans:${userId}`;
	return remember(cacheKey, () => loadLoans(userId, mode, 'all'));
}

export async function getCachedLoansByScope(
	userId: string,
	scope: LoanListScope,
	mode: LoanCacheMode = 'list'
) {
	return remember(`loans:${scope}:${mode}:${userId}`, () => loadLoans(userId, mode, scope));
}

async function loadLoansByIds(ids: number[], mode: LoanCacheMode) {
	if (ids.length === 0) return [];
	return mode === 'list'
		? db.query.loans.findMany({
				where: inArray(loans.id, ids),
				with: listRelations
			})
		: db.query.loans.findMany({
				where: inArray(loans.id, ids),
				with: fullRelations
			});
}

async function loadOwnedLoanIds(userId: string) {
	const rows = await db.select({ id: loans.id }).from(loans).where(eq(loans.userId, userId));
	return rows.map((r) => r.id);
}

async function loadInvestmentLoanIds(userId: string) {
	const investorRecord = await db.query.investors.findFirst({
		where: eq(investors.investorUserId, userId),
		columns: { id: true }
	});
	if (!investorRecord) return [];
	const rows = await db
		.select({ loanId: loanInvestors.loanId })
		.from(loanInvestors)
		.where(eq(loanInvestors.investorId, investorRecord.id));
	return [...new Set(rows.map((r) => r.loanId))];
}

async function loadBorrowedLoanIds(userId: string) {
	const borrowerRecords = await db.query.borrowers.findMany({
		where: eq(borrowers.borrowerUserId, userId),
		columns: { id: true }
	});
	if (borrowerRecords.length === 0) return [];
	const borrowerIds = borrowerRecords.map((b) => b.id);
	const rows = await db
		.select({ id: loans.id })
		.from(loans)
		.where(inArray(loans.borrowerId, borrowerIds));
	return rows.map((r) => r.id);
}

async function loadWitnessedLoanIds(userId: string) {
	const witnessRecords = await db.query.witnesses.findMany({
		where: eq(witnesses.witnessUserId, userId),
		columns: { id: true }
	});
	if (witnessRecords.length === 0) return [];
	const witnessIds = witnessRecords.map((w) => w.id);
	const rows = await db
		.select({ loanId: loanSigningInvitations.loanId })
		.from(loanSigningInvitations)
		.where(inArray(loanSigningInvitations.witnessId, witnessIds));
	return [...new Set(rows.map((r) => r.loanId))];
}

async function loadLoans(userId: string, mode: LoanCacheMode, scope: LoanListScope) {
	let ids: number[] = [];

	if (scope === 'owned') {
		ids = await loadOwnedLoanIds(userId);
	} else if (scope === 'investments') {
		ids = await loadInvestmentLoanIds(userId);
	} else if (scope === 'borrowed') {
		ids = await loadBorrowedLoanIds(userId);
	} else if (scope === 'witnessed') {
		ids = await loadWitnessedLoanIds(userId);
	} else {
		const [owned, invested, borrowed, witnessed] = await Promise.all([
			loadOwnedLoanIds(userId),
			loadInvestmentLoanIds(userId),
			loadBorrowedLoanIds(userId),
			loadWitnessedLoanIds(userId)
		]);
		ids = [...new Set([...owned, ...invested, ...borrowed, ...witnessed])];
	}

	const result = await loadLoansByIds(ids, mode);
	return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getCachedInvestors(
	userId: string,
	mode: InvestorCacheMode | boolean = 'full'
) {
	const resolved: InvestorCacheMode = typeof mode === 'boolean' ? (mode ? 'simple' : 'full') : mode;
	return remember(`investors:${userId}:${resolved}`, () => loadInvestors(userId, resolved));
}

async function loadInvestors(userId: string, mode: InvestorCacheMode) {
	const simpleColumns = {
		id: true,
		name: true,
		email: true,
		contactNumber: true,
		address: true,
		validIdUrl: true,
		eSignatureUrl: true
	};

	const ownedInvestors =
		mode === 'simple'
			? await db.query.investors.findMany({
					where: eq(investors.userId, userId),
					columns: simpleColumns
				})
			: mode === 'list'
				? await db.query.investors.findMany({
						where: eq(investors.userId, userId),
						with: {
							loanInvestors: {
								with: {
									loan: { columns: { id: true, status: true } },
									interestPeriods: {
										columns: { interestRate: true, interestType: true, dueDate: true }
									}
								}
							},
							transactions: { columns: { date: true, balance: true } }
						}
					})
				: await db.query.investors.findMany({
						where: eq(investors.userId, userId),
						with: {
							loanInvestors: { with: { loan: true } },
							transactions: true
						}
					});

	const userAsInvestor = await db.query.investors.findFirst({
		where: eq(investors.investorUserId, userId),
		columns: { id: true }
	});

	if (!userAsInvestor) return ownedInvestors;

	const shared = await db.query.loanInvestors.findMany({
		where: eq(loanInvestors.investorId, userAsInvestor.id),
		columns: {},
		with: {
			loan: {
				columns: { id: true },
				with: {
					loanInvestors: {
						columns: {},
						with: {
							investor:
								mode === 'simple'
									? { columns: simpleColumns }
									: mode === 'list'
										? {
												with: {
													loanInvestors: {
														with: {
															loan: { columns: { id: true, status: true } },
															interestPeriods: {
																columns: { interestRate: true, interestType: true }
															}
														}
													},
													transactions: { columns: { date: true, balance: true } }
												}
											}
										: {
												with: {
													loanInvestors: { with: { loan: true } },
													transactions: true
												}
											}
						}
					}
				}
			}
		}
	});

	const ownedList = ownedInvestors as Array<(typeof ownedInvestors)[number] & { id: number }>;
	const allInvestors = new Map(ownedList.map((investor) => [investor.id, investor]));
	for (const investment of shared) {
		for (const loanInvestor of investment.loan.loanInvestors) {
			const coInvestor = loanInvestor.investor as (typeof ownedList)[number];
			if (!allInvestors.has(coInvestor.id)) {
				allInvestors.set(coInvestor.id, coInvestor);
			}
		}
	}
	return Array.from(allInvestors.values());
}

export async function getCachedBorrowers(userId: string) {
	return remember(`borrowers:${userId}`, () =>
		db.query.borrowers.findMany({
			where: eq(borrowers.userId, userId),
			orderBy: (table, { asc }) => [asc(table.name)]
		})
	);
}

export async function getCachedWitnesses(userId: string) {
	return remember(`witnesses:${userId}`, () =>
		db.query.witnesses.findMany({
			where: eq(witnesses.userId, userId),
			orderBy: (table, { asc }) => [asc(table.name)]
		})
	);
}

export async function getCachedDebts(userId: string, investorId: number | null) {
	return remember(`debts:${userId}:${investorId ?? 'all'}`, async () => {
		const investorRecord = await db.query.investors.findFirst({
			where: eq(investors.investorUserId, userId),
			columns: { id: true }
		});

		return db.query.debts.findMany({
			where: investorId
				? and(eq(debts.userId, userId), eq(debts.investorId, investorId))
				: investorRecord
					? or(eq(debts.userId, userId), eq(debts.investorId, investorRecord.id))
					: eq(debts.userId, userId),
			orderBy: (table, { desc }) => [desc(table.date)],
			with: { investor: true }
		});
	});
}

export async function getCachedTransactions(userId: string, investorId: number | null) {
	return remember(`transactions:${userId}:${investorId ?? 'all'}`, async () => {
		const investorRecord = await db.query.investors.findFirst({
			where: eq(investors.investorUserId, userId),
			columns: { id: true }
		});

		return db.query.transactions.findMany({
			where: investorId
				? and(eq(transactions.userId, userId), eq(transactions.investorId, investorId))
				: investorRecord
					? or(eq(transactions.userId, userId), eq(transactions.investorId, investorRecord.id))
					: eq(transactions.userId, userId),
			orderBy: (table, { desc }) => [desc(table.date)],
			with: { investor: true }
		});
	});
}
