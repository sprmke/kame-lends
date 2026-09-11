import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  loans,
  loanInvestors,
  interestPeriods,
  receivedPayments,
} from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import {
  getLoanAccessContext,
  hasLoanAdminAccess,
} from "$lib/server/access-control";
import { listPaymentMethodsForBorrowerLoanView } from "$lib/server/payment-methods";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import {
  syncSigningInvitationsForLoan,
  upsertLoanContractCustomization,
} from "$lib/server/loan-contract-persistence";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import { normalizeReceiptImageUrl } from "$lib/receipt-image";

export const GET: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const loanId = parseInt(id);

    const access = await getLoanAccessContext(loanId, session.user.id);
    if (!access.canView) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        borrower: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
        loanWitnesses: {
          with: {
            witness: true,
          },
        },
        transactions: {
          orderBy: (transactions, { asc }) => [asc(transactions.date)],
        },
        loanContract: true,
      },
    });

    if (!loan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const paymentMethods = await listPaymentMethodsForBorrowerLoanView(
      loan.userId,
      access,
    );

    return json({
      ...loan,
      access,
      ...(access.memberships.includes("borrower") ? { paymentMethods } : {}),
    });
  } catch (error) {
    console.error("Error fetching loan:", error);
    return json({ error: "Failed to fetch loan" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const loanId = parseInt(id);
    const body = await request.json();
    const {
      loanData,
      investorData,
      receivedPaymentsByInvestor = [],
      contractCustomization = null,
    } = body;

    console.log("Updating loan:", loanId);
    console.log("Received loan data:", loanData);
    console.log("Received investor data:", investorData);

    if (!(await hasLoanAdminAccess(loanId, session.user.id))) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const existingLoan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        loanInvestors: {
          with: {
            interestPeriods: true,
          },
        },
      },
    });

    if (!existingLoan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    // Convert date strings to Date objects and ensure proper types
    const processedLoanData = {
      borrowerId: loanData.borrowerId ? Number(loanData.borrowerId) : null,
      loanName: loanData.loanName,
      type: loanData.type,
      status: loanData.status,
      dueDate: new Date(loanData.dueDate),
      freeLotSqm: loanData.freeLotSqm ? Number(loanData.freeLotSqm) : null,
      notes: loanData.notes || null,
      // Borrower profit is optional in this payload — preserve the existing
      // value when the caller (e.g. an older LoanForm submission) omits it.
      profitType:
        loanData.profitType === "fixed" || loanData.profitType === "rate"
          ? loanData.profitType
          : existingLoan.profitType,
      profitValue:
        loanData.profitValue !== undefined && loanData.profitValue !== null
          ? String(loanData.profitValue)
          : existingLoan.profitValue,
      updatedAt: new Date(),
    };

    // Update loan
    await db
      .update(loans)
      .set(processedLoanData)
      .where(and(eq(loans.id, loanId), eq(loans.userId, session.user.id)));

    // Fetch existing interest periods before deleting (to preserve completed statuses)
    const existingLoanInvestors = await db.query.loanInvestors.findMany({
      where: eq(loanInvestors.loanId, loanId),
      with: {
        interestPeriods: true,
      },
    });

    // Create a map of existing periods by investor and due date for easy lookup
    const existingPeriodsMap = new Map<
      string,
      { status: string; interestRate: string; interestType: string }
    >();
    existingLoanInvestors.forEach((li) => {
      if (li.interestPeriods) {
        li.interestPeriods.forEach((period) => {
          const key = `${li.investorId}-${period.dueDate.toISOString()}`;
          existingPeriodsMap.set(key, {
            status: period.status,
            interestRate: period.interestRate,
            interestType: period.interestType,
          });
        });
      }
    });

    // Delete existing loan investors (cascade will delete interest periods)
    await db.delete(loanInvestors).where(eq(loanInvestors.loanId, loanId));

    // Insert updated loan investors
    if (investorData && investorData.length > 0) {
      const loanInvestorData = investorData.map((inv: any) => ({
        loanId,
        investorId: Number(inv.investorId),
        amount: String(inv.amount),
        interestRate: inv.interestRate ? String(inv.interestRate) : "0",
        // Explicitly check for 'fixed' to ensure proper enum value is saved
        interestType: inv.interestType === "fixed" ? "fixed" : "rate",
        sentDate: new Date(inv.sentDate),
        isPaid: inv.isPaid ?? true, // Default to true for backward compatibility
        hasMultipleInterest: inv.hasMultipleInterest || false,
        receiptImageUrl: normalizeReceiptImageUrl(inv.receiptImageUrl),
        receiptExtractedData: inv.receiptExtractedData ?? null,
      }));

      const insertedLoanInvestors = await db
        .insert(loanInvestors)
        .values(loanInvestorData)
        .returning();

      // Insert interest periods if any
      // Group by investor to avoid inserting periods multiple times for the same investor
      const processedInvestors = new Set<number>();

      for (let i = 0; i < investorData.length; i++) {
        const inv = investorData[i];
        const investorId = Number(inv.investorId);

        console.log(`Processing investor ${i} (ID: ${investorId}):`, {
          hasMultipleInterest: inv.hasMultipleInterest,
          interestPeriodsLength: inv.interestPeriods?.length || 0,
          interestPeriods: inv.interestPeriods,
          alreadyProcessed: processedInvestors.has(investorId),
        });

        // Only insert interest periods once per investor (skip if already processed)
        if (
          !processedInvestors.has(investorId) &&
          inv.hasMultipleInterest &&
          inv.interestPeriods &&
          inv.interestPeriods.length > 0
        ) {
          const loanInvestorId = insertedLoanInvestors[i].id;
          const periodData = inv.interestPeriods.map((period: any) => {
            const dueDate = new Date(period.dueDate);
            const newInterestRate = String(period.interestRate);
            // Explicitly check for 'fixed' to ensure proper enum value is used
            const newInterestType =
              period.interestType === "fixed" ? "fixed" : "rate";

            // Check if this period existed before with same date/rate
            const key = `${investorId}-${dueDate.toISOString()}`;
            const existingPeriod = existingPeriodsMap.get(key);

            // Preserve completed status only if date and rate haven't changed
            let status: "Pending" | "Completed" | "Overdue" = "Pending";
            if (existingPeriod) {
              const rateChanged =
                existingPeriod.interestRate !== newInterestRate;
              const typeChanged =
                existingPeriod.interestType !== newInterestType;

              // If nothing changed and it was completed, keep it completed
              if (
                !rateChanged &&
                !typeChanged &&
                existingPeriod.status === "Completed"
              ) {
                status = "Completed";
              } else if (
                existingPeriod.status === "Overdue" &&
                !rateChanged &&
                !typeChanged
              ) {
                // Also preserve Overdue status if rate/type unchanged
                status = "Overdue";
              }
            }

            return {
              loanInvestorId,
              dueDate,
              interestRate: newInterestRate,
              interestType: newInterestType,
              status,
            };
          });

          console.log(
            "Inserting interest periods for loanInvestorId:",
            loanInvestorId,
            periodData,
          );
          await db.insert(interestPeriods).values(periodData);
          console.log("Interest periods inserted successfully");

          processedInvestors.add(investorId);
        }
      }

      // Map each investor to their first loan_investor id (for received payments)
      const investorToLoanInvestorId = new Map<number, number>();
      for (let i = 0; i < investorData.length; i++) {
        const investorId = Number(investorData[i].investorId);
        if (!investorToLoanInvestorId.has(investorId)) {
          investorToLoanInvestorId.set(investorId, insertedLoanInvestors[i].id);
        }
      }

      // Insert received payments per investor
      for (const entry of receivedPaymentsByInvestor) {
        const loanInvestorId = investorToLoanInvestorId.get(
          Number(entry.investorId),
        );
        if (
          !loanInvestorId ||
          !entry.receivedPayments ||
          !Array.isArray(entry.receivedPayments)
        ) {
          continue;
        }
        const receivedPayload = entry.receivedPayments.map((rp: any) => ({
          loanInvestorId,
          amount: String(rp.amount),
          receivedDate: new Date(rp.receivedDate),
        }));
        if (receivedPayload.length > 0) {
          await db.insert(receivedPayments).values(receivedPayload);
        }
      }
    }

    // Fetch the updated loan with investors
    const updatedLoan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        borrower: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    console.log("Loan updated successfully:", updatedLoan);

    if (updatedLoan) {
      if (contractCustomization) {
        await upsertLoanContractCustomization(
          updatedLoan,
          contractCustomization as ContractCustomization,
        );
      }
      await syncSigningInvitationsForLoan(updatedLoan);
    }

    invalidateLoanData();
    return json(updatedLoan);
  } catch (error) {
    console.error("Error updating loan:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return json(
      {
        error: "Failed to update loan",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const loanId = parseInt(id);

    // Verify access
    const hasAccess = await hasLoanAdminAccess(loanId, session.user.id);
    if (!hasAccess) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    // Delete loan (cascade will handle loan_investors)
    await db
      .delete(loans)
      .where(and(eq(loans.id, loanId), eq(loans.userId, session.user.id)));

    invalidateLoanData();
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting loan:", error);
    return json({ error: "Failed to delete loan" }, { status: 500 });
  }
};
