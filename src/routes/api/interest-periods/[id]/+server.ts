import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { interestPeriods, loanInvestors, loans, receivedPayments } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '$lib/server/session';
import { invalidateLoanData } from '$lib/server/cache-invalidation';
import { calculateInterest } from '$lib/calculations';

const AMOUNT_TOLERANCE = 0.02;

export const PATCH: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = params;
		const periodId = parseInt(id);
		const { status, receivedAmount, receivedDate } = await request.json();

		if (!status || !['Pending', 'Completed', 'Overdue'].includes(status)) {
			return json(
				{
					error: 'Invalid status. Must be Pending, Completed (record payment), or Overdue.'
				},
				{ status: 400 }
			);
		}

		const period = await db.query.interestPeriods.findFirst({
			where: eq(interestPeriods.id, periodId),
			with: {
				loanInvestor: {
					with: {
						loan: true,
						receivedPayments: {
							orderBy: [desc(receivedPayments.createdAt)]
						}
					}
				}
			}
		});

		if (!period) {
			return json({ error: 'Interest period not found' }, { status: 404 });
		}

		if (period.loanInvestor.loan.userId !== session.user.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const wasCompleted = period.status === 'Completed';
		const wasIncomplete = period.status === 'Incomplete';
		const isReverting =
			(wasCompleted || wasIncomplete) && (status === 'Pending' || status === 'Overdue');

		const loanIdForPrincipal = period.loanInvestor.loanId;
		const coInvestors = await db.query.loanInvestors.findMany({
			where: eq(loanInvestors.loanId, loanIdForPrincipal)
		});
		const loanTotalPrincipal = coInvestors.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0);
		const investorPrincipal = parseFloat(period.loanInvestor.amount) || 0;
		const principalBase = investorPrincipal === 0 ? loanTotalPrincipal : investorPrincipal;
		const expectedInterest = calculateInterest(
			principalBase,
			period.interestRate,
			period.interestType
		);

		/** Response status may differ from request (e.g. Incomplete vs Completed). */
		let responseStatus: string = status;

		if (status === 'Completed') {
			if (period.status === 'Completed') {
				return json({ error: 'This period is already completed.' }, { status: 400 });
			}

			const rawAmt = receivedAmount;
			const parsedAmount =
				rawAmt === '' || rawAmt === null || rawAmt === undefined ? NaN : parseFloat(String(rawAmt));
			const dateStr =
				receivedDate === null || receivedDate === undefined ? '' : String(receivedDate).trim();

			if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
				return json(
					{
						error: 'Enter a valid received amount greater than zero to record this payment.'
					},
					{ status: 400 }
				);
			}
			if (!dateStr) {
				return json({ error: 'Received date is required.' }, { status: 400 });
			}
			const receivedDateObj = new Date(dateStr);
			if (Number.isNaN(receivedDateObj.getTime())) {
				return json({ error: 'Invalid received date.' }, { status: 400 });
			}

			const linkedBefore = (period.loanInvestor.receivedPayments || []).filter(
				(rp) => rp.interestPeriodId === periodId
			);
			const priorTotal = linkedBefore.reduce((s, rp) => s + (parseFloat(rp.amount) || 0), 0);

			if (priorTotal + AMOUNT_TOLERANCE >= expectedInterest) {
				return json({ error: 'This period is already fully paid.' }, { status: 400 });
			}

			const newTotal = priorTotal + parsedAmount;
			if (newTotal > expectedInterest + AMOUNT_TOLERANCE) {
				return json(
					{
						error: `This payment would exceed the interest due for this period (${expectedInterest.toFixed(2)}). Remaining: ${(expectedInterest - priorTotal).toFixed(2)}.`
					},
					{ status: 400 }
				);
			}

			const newPeriodStatus =
				newTotal + AMOUNT_TOLERANCE >= expectedInterest ? 'Completed' : 'Incomplete';

			await db
				.update(interestPeriods)
				.set({ status: newPeriodStatus, updatedAt: new Date() })
				.where(eq(interestPeriods.id, periodId));

			await db.insert(receivedPayments).values({
				loanInvestorId: period.loanInvestor.id,
				interestPeriodId: periodId,
				amount: String(parsedAmount),
				receivedDate: receivedDateObj
			});

			responseStatus = newPeriodStatus;
		} else if (isReverting) {
			await db
				.update(interestPeriods)
				.set({ status, updatedAt: new Date() })
				.where(eq(interestPeriods.id, periodId));

			const removed = await db
				.delete(receivedPayments)
				.where(eq(receivedPayments.interestPeriodId, periodId))
				.returning();

			if (removed.length === 0) {
				const existingPayments = period.loanInvestor.receivedPayments || [];
				const matchingPayment =
					existingPayments.find(
						(rp) => Math.abs((parseFloat(rp.amount) || 0) - expectedInterest) <= AMOUNT_TOLERANCE
					) ?? existingPayments[0];

				if (matchingPayment) {
					await db.delete(receivedPayments).where(eq(receivedPayments.id, matchingPayment.id));
				}
			}
		} else {
			await db
				.update(interestPeriods)
				.set({ status, updatedAt: new Date() })
				.where(eq(interestPeriods.id, periodId));
		}

		const loanId = period.loanInvestor.loanId;
		const allLoanInvestors = await db.query.loanInvestors.findMany({
			where: eq(loanInvestors.loanId, loanId),
			with: {
				interestPeriods: true
			}
		});

		const now = new Date();
		for (const li of allLoanInvestors) {
			if (li.hasMultipleInterest && li.interestPeriods) {
				for (const p of li.interestPeriods) {
					if (p.id === periodId) continue;

					const periodDueDate = new Date(p.dueDate);
					if (p.status === 'Pending' && now > periodDueDate) {
						await db
							.update(interestPeriods)
							.set({ status: 'Overdue', updatedAt: now })
							.where(eq(interestPeriods.id, p.id));
					}
				}
			}
		}

		const updatedLoanInvestors = await db.query.loanInvestors.findMany({
			where: eq(loanInvestors.loanId, loanId),
			with: {
				interestPeriods: true
			}
		});

		const allPeriods: Array<{ status: string }> = [];
		updatedLoanInvestors.forEach((li) => {
			if (li.hasMultipleInterest && li.interestPeriods) {
				allPeriods.push(...li.interestPeriods);
			}
		});

		const hasOverduePeriod = allPeriods.some((p) => p.status === 'Overdue');
		const hasIncompletePeriod = allPeriods.some((p) => p.status === 'Incomplete');
		const allPeriodsCompleted =
			allPeriods.length > 0 && allPeriods.every((p) => p.status === 'Completed');

		const currentLoan = await db.query.loans.findFirst({
			where: eq(loans.id, loanId)
		});

		if (currentLoan) {
			let newLoanStatus = currentLoan.status;

			if (hasOverduePeriod || hasIncompletePeriod) {
				newLoanStatus = 'Overdue';
			} else if (allPeriodsCompleted) {
				const allPaid = updatedLoanInvestors.every((li) => li.isPaid);

				if (allPaid) {
					newLoanStatus = 'Completed';
				}
			} else if (currentLoan.status === 'Overdue' && !hasOverduePeriod && !hasIncompletePeriod) {
				newLoanStatus = 'Fully Funded';
			}

			if (newLoanStatus !== currentLoan.status) {
				await db
					.update(loans)
					.set({ status: newLoanStatus, updatedAt: new Date() })
					.where(eq(loans.id, loanId));
			}
		}

		invalidateLoanData();
		return json({ success: true, status: responseStatus });
	} catch (error) {
		console.error('Error updating interest period status:', error);
		return json({ error: 'Failed to update interest period status' }, { status: 500 });
	}
};
