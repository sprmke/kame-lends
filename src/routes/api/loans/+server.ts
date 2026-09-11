import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  loans,
  loanInvestors,
  interestPeriods,
  receivedPayments,
} from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { saveLoanContractAndInvitations } from "$lib/server/loan-contract-persistence";
import { toSigningInvitationSummary } from "$lib/loan-signing";
import { getCachedLoans } from "$lib/server/cached-data";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { workspaceAdminForbidden } from "$lib/server/workspace-admin";
import { normalizeReceiptImageUrl } from "$lib/receipt-image";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    return json(await getCachedLoans(session.user.id));
  } catch (error) {
    console.error("Error fetching loans:", error);
    return json({ error: "Failed to fetch loans" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  const request = event.request;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const forbidden = await workspaceAdminForbidden(session.user.id);
    if (forbidden) return forbidden;

    const body = await request.json();
    const {
      loanData,
      investorData,
      receivedPaymentsByInvestor = [],
      contractCustomization = null,
    } = body;

    console.log("Received loan data:", loanData);
    console.log("Received investor data:", investorData);

    // Convert date strings to Date objects and ensure proper types
    const processedLoanData = {
      userId: session.user.id,
      borrowerId: loanData.borrowerId ? Number(loanData.borrowerId) : null,
      loanName: loanData.loanName,
      type: loanData.type,
      status: loanData.status,
      dueDate: new Date(loanData.dueDate),
      freeLotSqm: loanData.freeLotSqm ? Number(loanData.freeLotSqm) : null,
      notes: loanData.notes || null,
      profitType:
        loanData.profitType === "fixed"
          ? ("fixed" as const)
          : ("rate" as const),
      profitValue:
        loanData.profitValue !== undefined && loanData.profitValue !== null
          ? String(loanData.profitValue)
          : "0",
    };

    console.log("Processed loan data:", processedLoanData);

    // Insert loan
    const newLoan = await db
      .insert(loans)
      .values(processedLoanData)
      .returning();
    console.log("Loan inserted:", newLoan);
    const loanId = newLoan[0].id;

    // Insert loan investors with proper date conversion
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

    console.log("Loan investor data:", loanInvestorData);

    const insertedLoanInvestors = await db
      .insert(loanInvestors)
      .values(loanInvestorData)
      .returning();
    console.log("Loan investors inserted");

    // Insert interest periods if any
    // Group by investor to avoid inserting periods multiple times for the same investor
    const processedInvestors = new Set<number>();

    for (let i = 0; i < investorData.length; i++) {
      const inv = investorData[i];
      const investorId = Number(inv.investorId);

      // Only insert interest periods once per investor (skip if already processed)
      if (
        !processedInvestors.has(investorId) &&
        inv.hasMultipleInterest &&
        inv.interestPeriods &&
        inv.interestPeriods.length > 0
      ) {
        const loanInvestorId = insertedLoanInvestors[i].id;
        const periodData = inv.interestPeriods.map((period: any) => ({
          loanInvestorId,
          dueDate: new Date(period.dueDate),
          interestRate: String(period.interestRate),
          // Explicitly check for 'fixed' to ensure proper enum value is saved
          interestType: period.interestType === "fixed" ? "fixed" : "rate",
        }));

        await db.insert(interestPeriods).values(periodData);
        console.log(
          "Interest periods inserted for loan investor:",
          loanInvestorId,
        );

        processedInvestors.add(investorId);
      }
    }

    // Map each investor to their first loan_investor id and insert received payments
    const investorToLoanInvestorId = new Map<number, number>();
    for (let i = 0; i < investorData.length; i++) {
      const investorId = Number(investorData[i].investorId);
      if (!investorToLoanInvestorId.has(investorId)) {
        investorToLoanInvestorId.set(investorId, insertedLoanInvestors[i].id);
      }
    }
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

    // Fetch the complete loan with investors
    const completeLoan = await db.query.loans.findFirst({
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

    console.log("Complete loan fetched:", completeLoan);

    let signingInvitations: ReturnType<typeof toSigningInvitationSummary>[] =
      [];
    if (completeLoan) {
      const { invitations } = await saveLoanContractAndInvitations(
        completeLoan,
        contractCustomization,
      );
      const origin = process.env.PUBLIC_APP_URL;
      signingInvitations = invitations.map((invitation) =>
        toSigningInvitationSummary(
          {
            id: invitation.id,
            token: invitation.token,
            partyRole: invitation.partyRole,
            investorId: invitation.investorId,
            partyName: invitation.partyName,
            partyEmail: invitation.partyEmail,
            signatureDataUrl: invitation.signatureDataUrl,
            signedAt: invitation.signedAt,
            consentedAt: invitation.consentedAt,
            expiresAt: invitation.expiresAt,
            loanId: completeLoan.id,
          },
          origin,
          completeLoan.id,
        ),
      );
    }

    invalidateLoanData();
    return json({ ...completeLoan, signingInvitations }, { status: 201 });
  } catch (error) {
    console.error("Error creating loan:", error);
    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return json(
      {
        error: "Failed to create loan",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};
