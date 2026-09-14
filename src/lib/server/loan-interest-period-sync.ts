/**
 * Recalculate one interest period's status from linked received_payments rows,
 * then align loan.status with all periods (same rules as interest-periods PATCH).
 */
import { db } from "$lib/server/db";
import {
  interestPeriods,
  loanInvestors,
  loans,
  receivedPayments,
} from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import {
  calculateInterest,
  calculateTotalAmount,
  calculateTotalReceived,
  isLoanFullyReceived,
} from "$lib/calculations";
import {
  deriveLoanStatusFromPeriods,
  interestPeriodStatusFlags,
} from "$lib/loan-status";
import type { LoanStatus } from "$lib/types";

const AMOUNT_TOLERANCE = 0.02;

export async function recalculateInterestPeriodStatusFromLinkedPayments(
  periodId: number,
): Promise<{ loanId: number } | null> {
  const period = await db.query.interestPeriods.findFirst({
    where: eq(interestPeriods.id, periodId),
    with: {
      loanInvestor: {
        with: {
          loan: true,
        },
      },
    },
  });

  if (!period) return null;

  const linkedRows = await db.query.receivedPayments.findMany({
    where: eq(receivedPayments.interestPeriodId, periodId),
  });

  const priorTotal = linkedRows.reduce(
    (s, rp) => s + (parseFloat(rp.amount) || 0),
    0,
  );

  const coInvestors = await db.query.loanInvestors.findMany({
    where: eq(loanInvestors.loanId, period.loanInvestor.loanId),
  });
  const loanTotalPrincipal = coInvestors.reduce(
    (s, li) => s + (parseFloat(li.amount) || 0),
    0,
  );
  const investorPrincipal = parseFloat(period.loanInvestor.amount) || 0;
  const principalBase =
    investorPrincipal === 0 ? loanTotalPrincipal : investorPrincipal;
  const expectedInterest = calculateInterest(
    principalBase,
    period.interestRate,
    period.interestType,
  );

  let newStatus: "Pending" | "Overdue" | "Incomplete" | "Completed";
  if (priorTotal <= AMOUNT_TOLERANCE) {
    const now = new Date();
    const due = new Date(period.dueDate);
    newStatus = now > due ? "Overdue" : "Pending";
  } else if (priorTotal + AMOUNT_TOLERANCE >= expectedInterest) {
    newStatus = "Completed";
  } else {
    newStatus = "Incomplete";
  }

  await db
    .update(interestPeriods)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(interestPeriods.id, periodId));

  return { loanId: period.loanInvestor.loanId };
}

export async function syncLoanStatusFromInterestPeriods(loanId: number) {
  const allLoanInvestors = await db.query.loanInvestors.findMany({
    where: eq(loanInvestors.loanId, loanId),
    with: {
      interestPeriods: true,
      receivedPayments: true,
    },
  });

  const fullyReceived = isLoanFullyReceived(
    calculateTotalAmount(allLoanInvestors),
    calculateTotalReceived(allLoanInvestors),
  );

  const now = new Date();
  if (!fullyReceived) {
    for (const li of allLoanInvestors) {
      if (li.hasMultipleInterest && li.interestPeriods) {
        for (const p of li.interestPeriods) {
          const periodDueDate = new Date(p.dueDate);
          if (p.status === "Pending" && now > periodDueDate) {
            await db
              .update(interestPeriods)
              .set({ status: "Overdue", updatedAt: now })
              .where(eq(interestPeriods.id, p.id));
          }
        }
      }
    }
  }

  const updatedLoanInvestors = fullyReceived
    ? allLoanInvestors
    : await db.query.loanInvestors.findMany({
        where: eq(loanInvestors.loanId, loanId),
        with: {
          interestPeriods: true,
          receivedPayments: true,
        },
      });

  const flags = interestPeriodStatusFlags(updatedLoanInvestors);
  const currentLoan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
  });

  if (!currentLoan) return;

  const newLoanStatus = deriveLoanStatusFromPeriods({
    currentStatus: currentLoan.status as LoanStatus,
    fullyReceived,
    hasOverduePeriod: flags.hasOverduePeriod,
    hasIncompletePeriod: flags.hasIncompletePeriod,
    allPeriodsCompleted: flags.allPeriodsCompleted,
    allDisbursementsPaid: updatedLoanInvestors.every((li) => li.isPaid),
  });

  if (newLoanStatus !== currentLoan.status) {
    await db
      .update(loans)
      .set({ status: newLoanStatus, updatedAt: new Date() })
      .where(eq(loans.id, loanId));
  }
}
