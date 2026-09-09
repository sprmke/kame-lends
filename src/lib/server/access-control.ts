import { db } from '$lib/server/db';
import {
	loans,
	loanInvestors,
	investors,
	borrowers,
	witnesses,
	loanSigningInvitations,
	transactions,
	debts,
	users
} from '$lib/server/db/schema';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import type { SigningPartyRole } from '$lib/loan-signing';
import { emailsMatch, normalizeEmail } from '$lib/loan-signing';
import type { LoanAccessContext, LoanMembership } from '$lib/loan-access';

export type { LoanAccessContext, LoanMembership };

/** View access for any loan party. Prefer getLoanAccessContext for writes/UI. */
export async function hasLoanAccess(loanId: number, userId: string): Promise<boolean> {
	return hasLoanViewAccess(loanId, userId);
}

export async function hasLoanViewAccess(loanId: number, userId: string): Promise<boolean> {
	const ownerOrInvestor = await db
		.select({ id: loans.id })
		.from(loans)
		.leftJoin(investors, eq(investors.investorUserId, userId))
		.leftJoin(
			loanInvestors,
			and(eq(loanInvestors.loanId, loans.id), eq(loanInvestors.investorId, investors.id))
		)
		.where(and(eq(loans.id, loanId), or(eq(loans.userId, userId), isNotNull(loanInvestors.id))))
		.limit(1);
	if (ownerOrInvestor.length > 0) return true;

	const asBorrower = await db
		.select({ id: loans.id })
		.from(loans)
		.innerJoin(borrowers, eq(borrowers.id, loans.borrowerId))
		.where(and(eq(loans.id, loanId), eq(borrowers.borrowerUserId, userId)))
		.limit(1);
	if (asBorrower.length > 0) return true;

	const asWitness = await db
		.select({ id: loanSigningInvitations.id })
		.from(loanSigningInvitations)
		.innerJoin(witnesses, eq(witnesses.id, loanSigningInvitations.witnessId))
		.where(and(eq(loanSigningInvitations.loanId, loanId), eq(witnesses.witnessUserId, userId)))
		.limit(1);
	return asWitness.length > 0;
}

export async function hasLoanAdminAccess(loanId: number, userId: string): Promise<boolean> {
	const rows = await db
		.select({ id: loans.id })
		.from(loans)
		.where(and(eq(loans.id, loanId), eq(loans.userId, userId)))
		.limit(1);
	return rows.length > 0;
}

export async function hasInvestorAllocationAccess(
	loanId: number,
	userId: string,
	investorId: number
): Promise<boolean> {
	if (await hasLoanAdminAccess(loanId, userId)) return true;

	const rows = await db
		.select({ id: loanInvestors.id })
		.from(loanInvestors)
		.innerJoin(investors, eq(investors.id, loanInvestors.investorId))
		.where(
			and(
				eq(loanInvestors.loanId, loanId),
				eq(loanInvestors.investorId, investorId),
				eq(investors.investorUserId, userId)
			)
		)
		.limit(1);

	return rows.length > 0;
}

export async function resolveLoanMemberships(
	loanId: number,
	userId: string
): Promise<LoanMembership[]> {
	const ctx = await getLoanAccessContext(loanId, userId);
	return ctx.memberships;
}

export async function getLoanAccessContext(
	loanId: number,
	userId: string
): Promise<LoanAccessContext> {
	const empty: LoanAccessContext = {
		memberships: [],
		canView: false,
		canAdminEdit: false,
		editableInvestorIds: [],
		signingPartyRoles: [],
		linkedInvestorId: null
	};

	const [sessionUser, loan] = await Promise.all([
		db.query.users.findFirst({
			where: eq(users.id, userId),
			columns: { id: true, email: true }
		}),
		db.query.loans.findFirst({
			where: eq(loans.id, loanId),
			columns: { id: true, userId: true, borrowerId: true },
			with: {
				borrower: { columns: { id: true, borrowerUserId: true, email: true } },
				loanInvestors: {
					columns: { investorId: true },
					with: {
						investor: { columns: { id: true, investorUserId: true, email: true } }
					}
				},
				signingInvitations: {
					columns: {
						partyRole: true,
						partyEmail: true,
						investorId: true,
						witnessId: true
					},
					with: {
						witness: { columns: { id: true, witnessUserId: true, email: true } }
					}
				}
			}
		})
	]);

	if (!loan) return empty;

	const sessionEmail = sessionUser?.email ?? null;
	const memberships = new Set<LoanMembership>();
	const signingPartyRoles = new Set<SigningPartyRole>();
	const editableInvestorIds: number[] = [];
	let linkedInvestorId: number | null = null;

	const emailMatchesParty = (partyEmail: string | null | undefined) =>
		!!sessionEmail && emailsMatch(sessionEmail, partyEmail);

	if (loan.userId === userId) {
		memberships.add('owner');
	}

	for (const li of loan.loanInvestors) {
		if (li.investor?.investorUserId === userId) {
			memberships.add('investor');
			editableInvestorIds.push(li.investorId);
			linkedInvestorId = li.investorId;
			signingPartyRoles.add('lender');
		}
	}

	if (loan.borrower?.borrowerUserId === userId || emailMatchesParty(loan.borrower?.email)) {
		if (loan.borrower?.borrowerUserId === userId || emailMatchesParty(loan.borrower?.email)) {
			memberships.add('borrower');
			signingPartyRoles.add('borrower');
		}
	}

	for (const invitation of loan.signingInvitations ?? []) {
		const witnessLinked = invitation.witness?.witnessUserId === userId;
		const emailLinked = emailMatchesParty(invitation.partyEmail);

		if (invitation.partyRole === 'witness_1' || invitation.partyRole === 'witness_2') {
			if (witnessLinked || emailLinked) {
				memberships.add('witness');
				signingPartyRoles.add(invitation.partyRole);
			}
		}

		if (
			invitation.partyRole === 'borrower' &&
			(loan.borrower?.borrowerUserId === userId || emailLinked)
		) {
			memberships.add('borrower');
			signingPartyRoles.add('borrower');
		}

		if (invitation.partyRole === 'lender') {
			const linkedByInvestor =
				!!invitation.investorId &&
				loan.loanInvestors.some(
					(li) => li.investorId === invitation.investorId && li.investor?.investorUserId === userId
				);
			if (linkedByInvestor || emailLinked) {
				memberships.add('investor');
				signingPartyRoles.add('lender');
				if (invitation.investorId && linkedByInvestor) {
					editableInvestorIds.push(invitation.investorId);
					linkedInvestorId = invitation.investorId;
				}
			}
		}
	}

	const witnessOnLoan = await db
		.select({ id: witnesses.id })
		.from(witnesses)
		.innerJoin(loanSigningInvitations, eq(loanSigningInvitations.witnessId, witnesses.id))
		.where(and(eq(loanSigningInvitations.loanId, loanId), eq(witnesses.witnessUserId, userId)))
		.limit(1);
	if (witnessOnLoan.length > 0) {
		memberships.add('witness');
	}

	const list = [...memberships];
	const canAdminEdit = memberships.has('owner');
	const uniqueEditable = [...new Set(editableInvestorIds)];

	return {
		memberships: list,
		canView: list.length > 0,
		canAdminEdit,
		editableInvestorIds: canAdminEdit
			? loan.loanInvestors.map((li) => li.investorId)
			: uniqueEditable,
		signingPartyRoles: [...signingPartyRoles],
		linkedInvestorId
	};
}

export async function getNavCapabilities(userId: string): Promise<{
	isAdminWorkspace: boolean;
	hasInvestments: boolean;
	hasBorrowed: boolean;
	hasWitnessed: boolean;
}> {
	const [ownedLoan, ownedInvestorContact, investorLink, borrowerLink, witnessLink] =
		await Promise.all([
			db.select({ id: loans.id }).from(loans).where(eq(loans.userId, userId)).limit(1),
			db.select({ id: investors.id }).from(investors).where(eq(investors.userId, userId)).limit(1),
			db
				.select({ id: investors.id })
				.from(investors)
				.where(eq(investors.investorUserId, userId))
				.limit(1),
			db
				.select({ id: borrowers.id })
				.from(borrowers)
				.where(eq(borrowers.borrowerUserId, userId))
				.limit(1),
			db
				.select({ id: witnesses.id })
				.from(witnesses)
				.where(eq(witnesses.witnessUserId, userId))
				.limit(1)
		]);

	return {
		isAdminWorkspace: ownedLoan.length > 0 || ownedInvestorContact.length > 0,
		hasInvestments: investorLink.length > 0,
		hasBorrowed: borrowerLink.length > 0,
		hasWitnessed: witnessLink.length > 0
	};
}

export async function hasTransactionAccess(
	transactionId: number,
	userId: string
): Promise<boolean> {
	const rows = await db
		.select({ id: transactions.id })
		.from(transactions)
		.leftJoin(
			investors,
			and(eq(investors.id, transactions.investorId), eq(investors.investorUserId, userId))
		)
		.where(
			and(
				eq(transactions.id, transactionId),
				or(eq(transactions.userId, userId), isNotNull(investors.id))
			)
		)
		.limit(1);

	return rows.length > 0;
}

export async function hasDebtAccess(debtId: number, userId: string): Promise<boolean> {
	const rows = await db
		.select({ id: debts.id })
		.from(debts)
		.leftJoin(
			investors,
			and(eq(investors.id, debts.investorId), eq(investors.investorUserId, userId))
		)
		.where(and(eq(debts.id, debtId), or(eq(debts.userId, userId), isNotNull(investors.id))))
		.limit(1);

	return rows.length > 0;
}

export { normalizeEmail, emailsMatch };
