import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import {
  applyContractCustomization,
  buildDefaultContractCustomizationFromLoan,
  parseStoredContractCustomization,
} from "$lib/loan-contract-customization";
import { buildLoanContractData } from "$lib/loan-contract-data";
import {
  applySigningSignatures,
  buildInvestorEmailMap,
  buildSavedPartySignaturesFromLoan,
  type SigningInvitationRecord,
} from "$lib/loan-signing";
import {
  getLoanAccessContext,
  hasLoanAdminAccess,
} from "$lib/server/access-control";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import {
  syncSigningInvitationsForLoan,
  upsertLoanContractCustomization,
} from "$lib/server/loan-contract-persistence";
import {
  loanContractPdfFilename,
  pdfResponse,
  renderLoanContractPdfBuffer,
} from "$lib/server/pdf/render";

export const config = {
  maxDuration: 60,
};

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = Number(event.params.id);
    if (Number.isNaN(loanId)) {
      return json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const access = await getLoanAccessContext(loanId, session.user.id);
    if (!access.canView) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        borrower: true,
        loanContract: true,
        signingInvitations: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    if (!loan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const baseData = buildLoanContractData(loan);
    const customization = parseStoredContractCustomization(
      loan.loanContract?.customization,
      buildDefaultContractCustomizationFromLoan(baseData),
    );
    const appliedData = applyContractCustomization(baseData, customization);
    const investorEmailById = buildInvestorEmailMap(loan);
    const merged = applySigningSignatures(
      appliedData,
      customization,
      (loan.signingInvitations ?? []) as SigningInvitationRecord[],
      investorEmailById,
      buildSavedPartySignaturesFromLoan(loan),
    );

    return json({
      contractData: merged.data,
      customization: merged.customization,
      signingInvitations: loan.signingInvitations ?? [],
      hasStoredContract: Boolean(loan.loanContract),
    });
  } catch (error) {
    console.error("Error fetching loan contract:", error);
    return json({ error: "Failed to fetch loan contract" }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async (event) => {
  const { request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = Number(event.params.id);
    if (Number.isNaN(loanId)) {
      return json({ error: "Invalid loan ID" }, { status: 400 });
    }

    if (!(await hasLoanAdminAccess(loanId, session.user.id))) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const customization = body.customization as
      ContractCustomization | undefined;
    if (!customization) {
      return json({ error: "Missing customization" }, { status: 400 });
    }

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        borrower: true,
        loanContract: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    if (!loan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const loanContract = await upsertLoanContractCustomization(
      loan,
      customization,
    );
    await syncSigningInvitationsForLoan(loan);
    invalidateLoanData();

    return json({
      loanContract,
      customization: loanContract.customization,
    });
  } catch (error) {
    console.error("Error saving loan contract:", error);
    return json({ error: "Failed to save contract" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const loanId = Number(event.params.id);
    if (Number.isNaN(loanId)) {
      return new Response("Invalid loan ID", { status: 400 });
    }

    const access = await getLoanAccessContext(loanId, session.user.id);
    if (!access.canView) {
      return new Response("Loan not found", { status: 404 });
    }

    const loan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        borrower: true,
        loanContract: true,
        signingInvitations: true,
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    if (!loan) {
      return new Response("Loan not found", { status: 404 });
    }

    const baseData = buildLoanContractData(loan);
    const customization = parseStoredContractCustomization(
      loan.loanContract?.customization,
      buildDefaultContractCustomizationFromLoan(baseData),
    );
    const appliedData = applyContractCustomization(baseData, customization);
    const investorEmailById = buildInvestorEmailMap(loan);
    const merged = applySigningSignatures(
      appliedData,
      customization,
      (loan.signingInvitations ?? []) as SigningInvitationRecord[],
      investorEmailById,
      buildSavedPartySignaturesFromLoan(loan),
    );

    const buffer = await renderLoanContractPdfBuffer(
      loan,
      merged.customization,
      merged.data,
    );
    return pdfResponse(buffer, loanContractPdfFilename(loan));
  } catch (error) {
    console.error("Error generating loan contract PDF:", error);
    return new Response("Failed to generate contract PDF", { status: 500 });
  }
};
