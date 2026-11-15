import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  loans,
  loanInvestors,
  interestPeriods,
  receivedPayments,
  loanSigningInvitations,
} from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { saveLoanContractAndInvitations } from "$lib/server/loan-contract-persistence";
import { toSigningInvitationSummary } from "$lib/loan-signing";
import { getCachedLoans } from "$lib/server/cached-data";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import {
  disbursementReceiptError,
  receiptColumnsFromInput,
  receivedPaymentReceiptError,
} from "$lib/payment-receipts";
import { resolveAppUrl } from "$lib/server/app-url";
import { validateLoanCrmOwnership } from "$lib/server/loan-crm-ownership";
import {
  loanPaymentNotesError,
  optionalPaymentNotes,
} from "$lib/payment-notes";
import {
  firstLoanWriteError,
  loanWriteErrorMap,
  loanWriteSchema,
} from "$lib/schemas/loan";
import { syncLoanStatusFromInterestPeriods } from "$lib/server/loan-interest-period-sync";
import { publicJsonError } from "$lib/server/http-error";
import { recordMoneyAudit } from "$lib/server/money-audit";
import {
  claimIdempotencyKey,
  findIdempotentResponse,
  idempotencyKeyOf,
  rememberIdempotentResponse,
} from "$lib/server/idempotency";
import { idempotencyKeys } from "$lib/server/db/schema";
import type { ContractCustomization } from "$lib/loan-contract-customization";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    return json(await getCachedLoans(userId, "list"));
  } catch (error) {
    console.error("Error fetching loans:", error);
    return json({ error: "Failed to fetch loans" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  const request = event.request;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    const idempotencyKey = idempotencyKeyOf(request);
    const idempotencyRoute = "POST /api/loans";
    if (idempotencyKey) {
      const replay = await findIdempotentResponse(
        idempotencyKey,
        userId,
        idempotencyRoute,
      );
      if (replay) {
        return json(replay.body as Record<string, unknown>, {
          status: replay.status,
        });
      }
    }

    const body = await request.json();
    const parsed = loanWriteSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          error: firstLoanWriteError(parsed.error),
          fieldErrors: loanWriteErrorMap(parsed.error),
        },
        { status: 400 },
      );
    }
    const {
      loanData,
      investorData,
      receivedPaymentsByInvestor,
      contractCustomization,
      groupIds: requestedGroupIds,
    } = parsed.data;

    const crmCheck = await validateLoanCrmOwnership(userId, {
      borrowerId: loanData.borrowerId,
      investorIds: investorData.map((investor) => investor.investorId),
    });
    if (!crmCheck.ok) {
      return json({ error: crmCheck.message }, { status: crmCheck.status });
    }

    const disbursementReceiptMessage = disbursementReceiptError(
      body.investorData,
    );
    if (disbursementReceiptMessage) {
      return json({ error: disbursementReceiptMessage }, { status: 400 });
    }
    const receivedReceiptMessage = receivedPaymentReceiptError(
      body.receivedPaymentsByInvestor ?? [],
    );
    if (receivedReceiptMessage) {
      return json({ error: receivedReceiptMessage }, { status: 400 });
    }
    const notesMessage = loanPaymentNotesError({
      investorData: body.investorData,
      receivedPaymentsByInvestor: body.receivedPaymentsByInvestor ?? [],
    });
    if (notesMessage) {
      return json({ error: notesMessage }, { status: 400 });
    }

    if (idempotencyKey) {
      const claimed = await claimIdempotencyKey(
        idempotencyKey,
        userId,
        idempotencyRoute,
      );
      if (!claimed) {
        const replay = await findIdempotentResponse(
          idempotencyKey,
          userId,
          idempotencyRoute,
        );
        return replay
          ? json(replay.body as Record<string, unknown>, {
              status: replay.status,
            })
          : json(
              { error: "This request is already in progress." },
              { status: 409 },
            );
      }
    }

    // Every write for one loan happens in one transaction: a failure part-way
    // leaves no orphan loan, allocations, periods, or payments behind.
    const loanId = await db.transaction(async (tx) => {
      const newLoan = await tx
        .insert(loans)
        .values({
          userId,
          borrowerId: loanData.borrowerId,
          loanName: loanData.loanName,
          type: loanData.type,
          // Status is derived on the server after the rows exist (DATA-08).
          status: investorData.some((investor) => investor.isPaid === false)
            ? "Partially Funded"
            : "Fully Funded",
          dueDate: loanData.dueDate,
          freeLotSqm: loanData.freeLotSqm,
          notes: loanData.notes,
          profitType: "rate",
          profitValue: "0",
        })
        .returning();
      const createdLoanId = newLoan[0].id;

      const insertedLoanInvestors = await tx
        .insert(loanInvestors)
        .values(
          investorData.map((investor, index) => ({
            loanId: createdLoanId,
            investorId: investor.investorId,
            amount: String(investor.amount),
            interestRate: String(investor.interestRate),
            interestType: investor.interestType,
            sentDate: investor.sentDate,
            isPaid: investor.isPaid,
            hasMultipleInterest: investor.hasMultipleInterest,
            notes: optionalPaymentNotes(
              (body.investorData as Array<{ notes?: unknown }>)[index]?.notes,
            ),
            ...receiptColumnsFromInput(
              (body.investorData as Array<Record<string, unknown>>)[index] ??
                {},
            ),
          })),
        )
        .returning();

      const processedInvestors = new Set<number>();
      for (let index = 0; index < investorData.length; index++) {
        const investor = investorData[index];
        if (
          processedInvestors.has(investor.investorId) ||
          !investor.hasMultipleInterest ||
          investor.interestPeriods.length === 0
        ) {
          continue;
        }
        const firstRow = investorData.findIndex(
          (row) => row.investorId === investor.investorId,
        );
        const loanInvestorId = insertedLoanInvestors[firstRow].id;
        await tx.insert(interestPeriods).values(
          investor.interestPeriods.map((period) => ({
            loanInvestorId,
            dueDate: period.dueDate,
            interestRate: String(period.interestRate),
            interestType: period.interestType,
          })),
        );
        processedInvestors.add(investor.investorId);
      }

      const investorToLoanInvestorId = new Map<number, number>();
      for (let index = 0; index < investorData.length; index++) {
        const investorId = investorData[index].investorId;
        if (!investorToLoanInvestorId.has(investorId)) {
          investorToLoanInvestorId.set(
            investorId,
            insertedLoanInvestors[index].id,
          );
        }
      }

      for (const entry of receivedPaymentsByInvestor) {
        const loanInvestorId = investorToLoanInvestorId.get(entry.investorId);
        if (!loanInvestorId || entry.receivedPayments.length === 0) continue;
        await tx.insert(receivedPayments).values(
          entry.receivedPayments.map((payment) => ({
            loanInvestorId,
            amount: String(payment.amount),
            receivedDate: payment.receivedDate,
            notes: optionalPaymentNotes(payment.notes),
            ...receiptColumnsFromInput(payment),
          })),
        );
      }

      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "loan",
        entityId: createdLoanId,
        loanId: createdLoanId,
        action: "create",
        after: {
          loanName: loanData.loanName,
          dueDate: loanData.dueDate,
          principal: investorData.reduce(
            (sum, investor) => sum + investor.amount,
            0,
          ),
          allocations: investorData.length,
        },
      });

      return createdLoanId;
    });

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

    await syncLoanStatusFromInterestPeriods(loanId).catch((syncError) => {
      console.error("[loans] status sync failed after create", syncError);
    });

    let signingInvitations: ReturnType<typeof toSigningInvitationSummary>[] =
      [];
    if (completeLoan) {
      const { invitations } = await saveLoanContractAndInvitations(
        completeLoan,
        contractCustomization as ContractCustomization | null | undefined,
      );
      const origin = resolveAppUrl();
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

    if (completeLoan) {
      try {
        const { applyGroupRulesForLoan } =
          await import("$lib/server/group-access");
        const { attachLoanToGroups } =
          await import("$lib/server/loan-group-attach");
        const { enqueueGroupLoanChanged } =
          await import("$lib/server/jobs/queue");
        const { scheduleDrain } =
          await import("$lib/server/jobs/after-response");

        const manualGroupIds = requestedGroupIds.filter(Number.isFinite);
        if (manualGroupIds.length > 0) {
          await attachLoanToGroups({
            loanId: completeLoan.id,
            groupIds: manualGroupIds,
            addedByUserId: userId,
          });
        }
        await applyGroupRulesForLoan(completeLoan.id, userId);
        try {
          const { applyGroupDefaultWitnessesToLoan } =
            await import("$lib/server/groups/apply-default-witnesses");
          await applyGroupDefaultWitnessesToLoan(completeLoan.id);
        } catch (witnessErr) {
          console.error("[groups] default witnesses failed", witnessErr);
        }
        try {
          const { applyAutoAttachSignatureToLoan } =
            await import("$lib/server/signing/auto-attach");
          await applyAutoAttachSignatureToLoan(completeLoan.id);
        } catch (autoSignErr) {
          console.error("[signing] auto attach failed", autoSignErr);
        }
        await enqueueGroupLoanChanged(completeLoan.id, {
          activity: {
            type: "loan_created",
            entityId: completeLoan.id,
            summary: `New loan: ${completeLoan.loanName}`,
          },
        });
        scheduleDrain(event);
      } catch (groupErr) {
        console.error(
          "[groups] apply rules after loan create failed",
          groupErr,
        );
      }

      try {
        const { sendLoanCreatedSigningEmails } =
          await import("$lib/server/email/loan-created-email");
        const freshInvitations = await db.query.loanSigningInvitations.findMany(
          {
            where: eq(loanSigningInvitations.loanId, completeLoan.id),
          },
        );
        const emailRecipients = (
          freshInvitations.length > 0 ? freshInvitations : signingInvitations
        ).filter((invitation) => !invitation.signedAt);
        const emailResult = await sendLoanCreatedSigningEmails({
          loanId: completeLoan.id,
          loanName: completeLoan.loanName,
          dueDate: completeLoan.dueDate,
          recipients: emailRecipients.map((invitation) => ({
            partyRole: invitation.partyRole,
            partyName: invitation.partyName,
            partyEmail: invitation.partyEmail,
          })),
        });
        if (emailResult.sent > 0 || emailResult.skipped > 0) {
          console.info("[email] loan-created signing emails", {
            loanId: completeLoan.id,
            ...emailResult,
          });
        }
      } catch (emailErr) {
        console.error("[email] loan-created signing emails failed", emailErr);
      }
    }

    const responseBody = { ...completeLoan, signingInvitations };
    if (idempotencyKey) {
      await rememberIdempotentResponse(
        idempotencyKey,
        userId,
        idempotencyRoute,
        201,
        responseBody,
      );
    }
    return json(responseBody, { status: 201 });
  } catch (error) {
    console.error("Error creating loan:", error);
    try {
      const key = event.request.headers.get("idempotency-key");
      if (key) {
        await db
          .delete(idempotencyKeys)
          .where(eq(idempotencyKeys.key, key.trim()));
      }
    } catch {
      /* cleanup is best-effort */
    }
    return json(publicJsonError("Failed to create loan", error), {
      status: 500,
    });
  }
};
