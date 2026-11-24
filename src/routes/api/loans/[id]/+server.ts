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
import { eq, and, inArray, isNull } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { assertLoanAdmin } from "$lib/server/route-auth";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import { loadLoanDetail } from "$lib/server/loan-detail";
import {
  syncSigningInvitationsForLoan,
  upsertLoanContractCustomization,
} from "$lib/server/loan-contract-persistence";
import type { ContractCustomization } from "$lib/loan-contract-customization";
import {
  disbursementReceiptError,
  receiptColumnsFromInput,
  receivedPaymentReceiptError,
} from "$lib/payment-receipts";
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
import { parseIdParam } from "$lib/server/route-params";
import { toLocalDateString } from "$lib/date-utils";
import { recordMoneyAudit } from "$lib/server/money-audit";
import { publicJsonError } from "$lib/server/http-error";
import {
  recalculateInterestPeriodStatusFromLinkedPayments,
  syncLoanStatusFromInterestPeriods,
} from "$lib/server/loan-interest-period-sync";
import {
  detectInterestDateExtensions,
  latestExtension,
  type PeriodDueSnapshot,
} from "$lib/loans/interest-extensions";

export const GET: RequestHandler = async (event) => {
  const { params } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = parseIdParam(params.id);
    if (loanId === null) {
      return json({ error: "Invalid loan id" }, { status: 400 });
    }
    const includeContract =
      event.url.searchParams.get("include") === "contract";
    const payload = await loadLoanDetail(loanId, userId, {
      includeContract,
    });
    if (!payload) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    return json(payload);
  } catch (error) {
    console.error("Error fetching loan:", error);
    return json({ error: "Failed to fetch loan" }, { status: 500 });
  }
};

class ReconcileConflict extends Error {
  status = 409 as const;
}

export const PUT: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = parseIdParam(params.id);
    if (loanId === null) {
      return json({ error: "Invalid loan id" }, { status: 400 });
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
    } = parsed.data;

    const authError = await assertLoanAdmin(loanId, userId);
    if (authError) return authError;

    const crmCheck = await validateLoanCrmOwnership(userId, {
      borrowerId: loanData.borrowerId,
      investorIds: investorData.map((investor) => investor.investorId),
    });
    if (!crmCheck.ok) {
      return json({ error: crmCheck.message }, { status: crmCheck.status });
    }

    const existingLoan = await db.query.loans.findFirst({
      where: and(eq(loans.id, loanId), isNull(loans.deletedAt)),
      with: {
        loanInvestors: {
          where: isNull(loanInvestors.deletedAt),
          with: {
            interestPeriods: true,
            receivedPayments: { where: isNull(receivedPayments.deletedAt) },
          },
        },
        signingInvitations: true,
      },
    });

    if (!existingLoan) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    const invitationsBefore = new Map(
      existingLoan.signingInvitations.map((invitation) => [
        invitation.id,
        {
          signedAt: invitation.signedAt,
          partyEmail: (invitation.partyEmail ?? "").trim().toLowerCase(),
        },
      ]),
    );

    const periodDueBefore: PeriodDueSnapshot[] =
      existingLoan.loanInvestors.flatMap((allocation) =>
        (allocation.interestPeriods ?? []).map((period) => ({
          id: period.id,
          dueDateKey: toLocalDateString(period.dueDate),
        })),
      );

    // Legacy rows may have been saved before receipts were required. Allow an
    // existing row to keep an empty receipt field, but only when its id really
    // belongs to this loan. New rows still need evidence.
    const existingAllocationIds = new Set(
      existingLoan.loanInvestors.map((allocation) => allocation.id),
    );
    const existingPaymentIds = new Set(
      existingLoan.loanInvestors.flatMap((allocation) =>
        (allocation.receivedPayments ?? []).map((payment) => payment.id),
      ),
    );
    // A payment may only point at a period that belongs to this loan and to
    // the same investor. The form sends old ids, so an invented id must fail.
    const periodOwner = new Map<number, number>();
    for (const allocation of existingLoan.loanInvestors) {
      for (const period of allocation.interestPeriods ?? []) {
        periodOwner.set(period.id, allocation.investorId);
      }
    }
    for (const entry of receivedPaymentsByInvestor) {
      for (const payment of entry.receivedPayments) {
        if (payment.interestPeriodId == null) continue;
        const owner = periodOwner.get(payment.interestPeriodId);
        if (owner !== entry.investorId) {
          return json(
            {
              error:
                "A received payment points at an interest period that does not belong to this investor.",
            },
            { status: 400 },
          );
        }
      }
    }

    const disbursementReceiptMessage = disbursementReceiptError(
      body.investorData,
      { existingIds: existingAllocationIds },
    );
    if (disbursementReceiptMessage) {
      return json({ error: disbursementReceiptMessage }, { status: 400 });
    }
    const receivedReceiptMessage = receivedPaymentReceiptError(
      body.receivedPaymentsByInvestor ?? [],
      { existingIds: existingPaymentIds },
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

    /**
     * Diff-based reconcile in one transaction (T3.2). Rows are matched by
     * stable id, updated in place, and only removed when the user explicitly
     * removes them. Payments are never re-created, so ids, receipts, and
     * period links survive an edit.
     */
    const confirmRemovals = parsed.data.confirmRemovals;
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(loans)
        .set({
          borrowerId: loanData.borrowerId,
          loanName: loanData.loanName,
          type: loanData.type,
          dueDate: loanData.dueDate,
          freeLotSqm: loanData.freeLotSqm,
          notes: loanData.notes,
          updatedAt: now,
        })
        .where(and(eq(loans.id, loanId), eq(loans.userId, userId)));

      // Only active rows may be matched. Soft-deleted rows must never be
      // revived by an old form that still carries their ids.
      const existingRows = await tx.query.loanInvestors.findMany({
        where: and(
          eq(loanInvestors.loanId, loanId),
          isNull(loanInvestors.deletedAt),
        ),
        with: {
          interestPeriods: true,
          receivedPayments: { where: isNull(receivedPayments.deletedAt) },
        },
      });

      const existingByInvestor = new Map<number, typeof existingRows>();
      for (const row of existingRows) {
        const group = existingByInvestor.get(row.investorId) ?? [];
        group.push(row);
        existingByInvestor.set(row.investorId, group);
      }

      const incomingByInvestor = new Map<
        number,
        { rowIndex: number; row: (typeof investorData)[number] }[]
      >();
      investorData.forEach((row, rowIndex) => {
        const group = incomingByInvestor.get(row.investorId) ?? [];
        group.push({ rowIndex, row });
        incomingByInvestor.set(row.investorId, group);
      });

      const firstAllocationIdByInvestor = new Map<number, number>();

      for (const [investorId, incoming] of incomingByInvestor) {
        const existing = existingByInvestor.get(investorId) ?? [];
        const used = new Set<number>();
        const keptAllocationIds: number[] = [];

        for (const { rowIndex, row } of incoming) {
          const idMatch =
            row.id != null
              ? existing.find(
                  (item) => item.id === row.id && !used.has(item.id),
                )
              : undefined;
          if (row.id != null && !idMatch) {
            // The id is gone or belongs to another investor: this form is
            // stale. Inserting would duplicate capital, so refuse.
            throw new ReconcileConflict(
              "This disbursement was changed or removed in another session. Reload the loan and try again.",
            );
          }
          const payload = {
            loanId,
            investorId,
            amount: String(row.amount),
            interestRate: String(row.interestRate),
            interestType: row.interestType,
            sentDate: row.sentDate,
            isPaid: row.isPaid,
            hasMultipleInterest: row.hasMultipleInterest,
            notes: optionalPaymentNotes(
              (body.investorData as Array<{ notes?: unknown }>)[rowIndex]
                ?.notes,
            ),
            ...receiptColumnsFromInput(
              (body.investorData as Array<Record<string, unknown>>)[rowIndex] ??
                {},
            ),
            deletedAt: null,
          };

          if (idMatch) {
            used.add(idMatch.id);
            await tx
              .update(loanInvestors)
              .set(payload)
              .where(eq(loanInvestors.id, idMatch.id));
            keptAllocationIds.push(idMatch.id);
          } else {
            const inserted = await tx
              .insert(loanInvestors)
              .values(payload)
              .returning();
            keptAllocationIds.push(inserted[0].id);
          }
        }

        const removedAllocations = existing.filter(
          (item) => !used.has(item.id),
        );
        if (removedAllocations.length > 0) {
          const hasPayments = removedAllocations.some(
            (item) => (item.receivedPayments?.length ?? 0) > 0,
          );
          if (hasPayments && !confirmRemovals) {
            throw new ReconcileConflict(
              "Removing this disbursement would orphan recorded payments. Remove the payments first, or confirm the removal.",
            );
          }
          const removedIds = removedAllocations.map((item) => item.id);
          if (hasPayments) {
            await tx
              .update(receivedPayments)
              .set({ deletedAt: now, updatedAt: now })
              .where(inArray(receivedPayments.loanInvestorId, removedIds));
          }
          await tx
            .update(loanInvestors)
            .set({ deletedAt: now })
            .where(inArray(loanInvestors.id, removedIds));
          for (const removed of removedAllocations) {
            await recordMoneyAudit(tx, {
              actorUserId: userId,
              entityType: "allocation",
              entityId: removed.id,
              loanId,
              action: "delete",
              reason: "removed from loan edit",
              before: {
                amount: removed.amount,
                investorId: removed.investorId,
              },
            });
          }
        }

        const scheduleAllocationId = keptAllocationIds[0];
        firstAllocationIdByInvestor.set(investorId, scheduleAllocationId);

        // Periods live on the investor's first allocation.
        const incomingPeriods = incoming[0].row.interestPeriods ?? [];
        const existingPeriods = existing.flatMap(
          (item) => item.interestPeriods ?? [],
        );
        const usedPeriodIds = new Set<number>();

        for (const period of incomingPeriods) {
          const match =
            period.id != null
              ? existingPeriods.find(
                  (item) =>
                    item.id === period.id && !usedPeriodIds.has(item.id),
                )
              : undefined;
          if (period.id != null && !match) {
            throw new ReconcileConflict(
              "This interest period was changed or removed in another session. Reload the loan and try again.",
            );
          }
          const payload = {
            loanInvestorId: scheduleAllocationId,
            dueDate: period.dueDate,
            interestRate: String(period.interestRate),
            interestType: period.interestType,
            updatedAt: now,
          };
          if (match) {
            usedPeriodIds.add(match.id);
            await tx
              .update(interestPeriods)
              .set(payload)
              .where(eq(interestPeriods.id, match.id));
          } else {
            await tx.insert(interestPeriods).values({
              ...payload,
              status: "Pending",
            });
          }
        }

        const removedPeriods = existingPeriods.filter(
          (item) => !usedPeriodIds.has(item.id),
        );
        if (removedPeriods.length > 0) {
          const linked = await tx.query.receivedPayments.findMany({
            where: and(
              inArray(
                receivedPayments.interestPeriodId,
                removedPeriods.map((item) => item.id),
              ),
              isNull(receivedPayments.deletedAt),
            ),
          });
          if (linked.length > 0 && !confirmRemovals) {
            throw new ReconcileConflict(
              "Removing an interest period would orphan recorded payments. Remove the payments first, or confirm the removal.",
            );
          }
          if (linked.length > 0) {
            await tx
              .update(receivedPayments)
              .set({ interestPeriodId: null, updatedAt: now })
              .where(
                inArray(
                  receivedPayments.id,
                  linked.map((item) => item.id),
                ),
              );
          }
          await tx.delete(interestPeriods).where(
            inArray(
              interestPeriods.id,
              removedPeriods.map((item) => item.id),
            ),
          );
        }
      }

      // Investors dropped from the form entirely: their allocations are not in
      // `incomingByInvestor`, so they would otherwise stay active and keep
      // counting toward the loan totals.
      for (const [investorId, droppedRows] of existingByInvestor) {
        if (incomingByInvestor.has(investorId)) continue;
        const droppedPayments = droppedRows.flatMap(
          (item) => item.receivedPayments ?? [],
        );
        if (droppedPayments.length > 0 && !confirmRemovals) {
          throw new ReconcileConflict(
            "Removing an investor would orphan recorded payments. Remove their payments first, or confirm the removal.",
          );
        }

        const droppedIds = droppedRows.map((item) => item.id);
        const droppedPeriodIds = droppedRows.flatMap((item) =>
          (item.interestPeriods ?? []).map((period) => period.id),
        );

        if (droppedPayments.length > 0) {
          await tx
            .update(receivedPayments)
            .set({ deletedAt: now, updatedAt: now })
            .where(
              and(
                inArray(receivedPayments.loanInvestorId, droppedIds),
                isNull(receivedPayments.deletedAt),
              ),
            );
        }

        if (droppedPeriodIds.length > 0) {
          await tx
            .update(receivedPayments)
            .set({ interestPeriodId: null, updatedAt: now })
            .where(
              and(
                inArray(receivedPayments.interestPeriodId, droppedPeriodIds),
                isNull(receivedPayments.deletedAt),
              ),
            );
          await tx
            .delete(interestPeriods)
            .where(inArray(interestPeriods.id, droppedPeriodIds));
        }

        await tx
          .update(loanInvestors)
          .set({ deletedAt: now })
          .where(inArray(loanInvestors.id, droppedIds));

        for (const dropped of droppedRows) {
          await recordMoneyAudit(tx, {
            actorUserId: userId,
            entityType: "allocation",
            entityId: dropped.id,
            loanId,
            action: "delete",
            reason: "investor removed from loan edit",
            before: {
              amount: dropped.amount,
              investorId: dropped.investorId,
              deletedPayments: droppedPayments.length,
            },
          });
        }
      }

      // Payments: update by id, insert new rows, soft-delete only the rows the
      // user removed from the form. A payment row is never re-created.
      const allExistingPayments = existingRows.flatMap(
        (item) => item.receivedPayments ?? [],
      );
      const usedPaymentIds = new Set<number>();

      for (const entry of receivedPaymentsByInvestor) {
        const loanInvestorId = firstAllocationIdByInvestor.get(
          entry.investorId,
        );
        if (!loanInvestorId) continue;

        for (const payment of entry.receivedPayments) {
          const numericId =
            typeof payment.id === "number"
              ? payment.id
              : typeof payment.id === "string" && /^\d+$/.test(payment.id)
                ? Number(payment.id)
                : null;
          const existingPayment = numericId
            ? allExistingPayments.find((item) => item.id === numericId)
            : undefined;
          if (numericId != null && !existingPayment) {
            throw new ReconcileConflict(
              "A received payment was removed in another session. Reload the loan and try again.",
            );
          }
          const payload = {
            loanInvestorId,
            interestPeriodId: payment.interestPeriodId ?? null,
            amount: String(payment.amount),
            receivedDate: payment.receivedDate,
            notes: optionalPaymentNotes(payment.notes),
            ...receiptColumnsFromInput(payment),
            updatedAt: now,
            deletedAt: null,
          };

          if (existingPayment) {
            usedPaymentIds.add(existingPayment.id);
            await tx
              .update(receivedPayments)
              .set(payload)
              .where(eq(receivedPayments.id, existingPayment.id));
          } else {
            await tx.insert(receivedPayments).values(payload);
          }
        }
      }

      const paymentOwner = new Map<number, number>();
      for (const row of existingRows) {
        for (const payment of row.receivedPayments ?? []) {
          paymentOwner.set(payment.id, row.investorId);
        }
      }

      const incomingPaymentIdsByInvestor = new Map<number, Set<number>>();
      for (const entry of receivedPaymentsByInvestor) {
        const ids = new Set<number>();
        for (const payment of entry.receivedPayments) {
          const numeric =
            typeof payment.id === "number"
              ? payment.id
              : typeof payment.id === "string" && /^\d+$/.test(payment.id)
                ? Number(payment.id)
                : null;
          if (numeric) ids.add(numeric);
        }
        incomingPaymentIdsByInvestor.set(entry.investorId, ids);
      }

      const removablePaymentIds = allExistingPayments
        .filter((payment) => {
          const owner = paymentOwner.get(payment.id);
          if (owner === undefined) return false;
          const incoming = incomingPaymentIdsByInvestor.get(owner);
          return incoming !== undefined && !incoming.has(payment.id);
        })
        .map((payment) => payment.id);

      if (removablePaymentIds.length > 0) {
        await tx
          .update(receivedPayments)
          .set({ deletedAt: now, updatedAt: now })
          .where(inArray(receivedPayments.id, removablePaymentIds));
      }

      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "loan",
        entityId: loanId,
        loanId,
        action: "update",
        before: {
          loanName: existingLoan.loanName,
          dueDate: existingLoan.dueDate,
          allocations: existingLoan.loanInvestors.length,
        },
        after: {
          loanName: loanData.loanName,
          dueDate: loanData.dueDate,
          allocations: investorData.length,
          removedPayments: removablePaymentIds.length,
        },
      });
    });

    // Period status is a function of linked payments, never of what the form
    // sent. Recompute every period, then the loan status.
    const allocationIds = await db
      .select({ id: loanInvestors.id })
      .from(loanInvestors)
      .where(eq(loanInvestors.loanId, loanId));
    if (allocationIds.length > 0) {
      const periods = await db
        .select({ id: interestPeriods.id })
        .from(interestPeriods)
        .where(
          inArray(
            interestPeriods.loanInvestorId,
            allocationIds.map((row) => row.id),
          ),
        );
      for (const period of periods) {
        await recalculateInterestPeriodStatusFromLinkedPayments(period.id);
      }
    }
    await syncLoanStatusFromInterestPeriods(loanId);

    const updatedLoan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        borrower: true,
        loanInvestors: {
          where: isNull(loanInvestors.deletedAt),
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: { where: isNull(receivedPayments.deletedAt) },
          },
        },
      },
    });

    if (updatedLoan) {
      if (contractCustomization) {
        await upsertLoanContractCustomization(
          updatedLoan,
          contractCustomization as ContractCustomization,
        );
      }
      await syncSigningInvitationsForLoan(updatedLoan);
      try {
        const { applyGroupDefaultWitnessesToLoan } =
          await import("$lib/server/groups/apply-default-witnesses");
        await applyGroupDefaultWitnessesToLoan(loanId);
      } catch (witnessErr) {
        console.error("[groups] default witnesses failed", witnessErr);
      }
      try {
        const { applyAutoAttachSignatureToLoan } =
          await import("$lib/server/signing/auto-attach");
        await applyAutoAttachSignatureToLoan(loanId);
      } catch (autoSignErr) {
        console.error("[signing] auto attach failed", autoSignErr);
      }

      try {
        const freshInvitations = await db.query.loanSigningInvitations.findMany(
          {
            where: eq(loanSigningInvitations.loanId, loanId),
          },
        );
        const newUnsigned = freshInvitations.filter((invitation) => {
          if (invitation.signedAt) return false;
          const before = invitationsBefore.get(invitation.id);
          if (!before) return true;
          const currentEmail = (invitation.partyEmail ?? "")
            .trim()
            .toLowerCase();
          return Boolean(before.signedAt) || before.partyEmail !== currentEmail;
        });
        if (newUnsigned.length > 0) {
          const { sendLoanCreatedSigningEmails } =
            await import("$lib/server/email/loan-created-email");
          await sendLoanCreatedSigningEmails({
            loanId,
            loanName: updatedLoan.loanName,
            dueDate: updatedLoan.dueDate,
            loanType: updatedLoan.type,
            loanStatus: updatedLoan.status,
            borrowerName: updatedLoan.borrower?.name ?? "",
            principal: updatedLoan.loanInvestors.reduce((sum, row) => {
              const amount = Number.parseFloat(row.amount);
              return sum + (Number.isFinite(amount) ? amount : 0);
            }, 0),
            investorNames: updatedLoan.loanInvestors
              .map((row) => row.investor?.name?.trim())
              .filter((name): name is string => Boolean(name)),
            recipients: newUnsigned.map((invitation) => ({
              partyRole: invitation.partyRole,
              partyName: invitation.partyName,
              partyEmail: invitation.partyEmail,
              invitationId: invitation.id,
            })),
          });
        }
      } catch (emailErr) {
        console.error("[email] new signing invitations failed", emailErr);
      }
    }

    invalidateLoanData();

    try {
      const { recomputeGroupsForLoans } =
        await import("$lib/server/group-access");
      const { enqueueGroupLoanChanged } =
        await import("$lib/server/jobs/queue");
      const { scheduleDrain } = await import("$lib/server/jobs/after-response");
      await recomputeGroupsForLoans([loanId]);

      const periodDueAfter: PeriodDueSnapshot[] = (
        updatedLoan?.loanInvestors ?? []
      ).flatMap((allocation) =>
        (allocation.interestPeriods ?? []).map((period) => ({
          id: period.id,
          dueDateKey: toLocalDateString(period.dueDate),
        })),
      );
      const extensions = detectInterestDateExtensions(
        periodDueBefore,
        periodDueAfter,
      );
      const latest = latestExtension(extensions);

      await enqueueGroupLoanChanged(loanId, {
        activity: latest
          ? {
              type: "interest_extended",
              entityId: latest.periodId,
              actorUserId: userId,
              actorEmail: session.user?.email ?? undefined,
              detail: {
                date: latest.dueDateKey,
                previousDate: latest.previousDueDateKey,
              },
              summary: updatedLoan?.loanName
                ? `Interest due date extended: ${updatedLoan.loanName}`
                : "Interest due date extended",
            }
          : {
              type: "loan_updated",
              entityId: loanId,
              actorUserId: userId,
              actorEmail: session.user?.email ?? undefined,
              summary: updatedLoan?.loanName
                ? `Loan updated: ${updatedLoan.loanName}`
                : "Loan updated",
            },
      });
      scheduleDrain(event);
    } catch (groupErr) {
      console.error("[groups] post-update sync failed", groupErr);
    }

    return json(updatedLoan);
  } catch (error) {
    if (error instanceof ReconcileConflict) {
      // The guard is a user-facing conflict, not a server failure. Without
      // this the 409 message was replaced by a generic 500.
      return json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating loan:", error);
    return json(publicJsonError("Failed to update loan", error), {
      status: 500,
    });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    const userId = session?.user?.id;
    if (!userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const loanId = parseIdParam(params.id);
    if (loanId === null) {
      return json({ error: "Invalid loan id" }, { status: 400 });
    }

    const authError = await assertLoanAdmin(loanId, userId);
    if (authError) return authError;

    const { loanGroupLoans, groupCalendars } =
      await import("$lib/server/db/schema");
    const { enqueueJob } = await import("$lib/server/jobs/queue");
    const { scheduleDrain } = await import("$lib/server/jobs/after-response");

    const groupLinks = await db
      .select({ groupId: loanGroupLoans.groupId })
      .from(loanGroupLoans)
      .where(eq(loanGroupLoans.loanId, loanId));
    const groupIds = groupLinks.map((r) => r.groupId);
    if (groupIds.length > 0) {
      const calendars = await db
        .select({
          groupId: groupCalendars.groupId,
          googleCalendarId: groupCalendars.googleCalendarId,
        })
        .from(groupCalendars)
        .where(inArray(groupCalendars.groupId, groupIds));
      const calMap = new Map(
        calendars.map((c) => [c.groupId, c.googleCalendarId]),
      );
      for (const groupId of groupIds) {
        const calendarId = calMap.get(groupId);
        if (calendarId) {
          await enqueueJob({
            kind: "group.calendar.removeLoan",
            groupId,
            payload: { loanId, calendarId },
          });
        }
      }
    }

    // Soft delete (D-8): the row and its money history stay, so it can be
    // restored and audited.
    const deletedLoan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      columns: { loanName: true },
    });
    await db.transaction(async (tx) => {
      await tx
        .update(loans)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(loans.id, loanId), eq(loans.userId, userId)));
      await recordMoneyAudit(tx, {
        actorUserId: userId,
        entityType: "loan",
        entityId: loanId,
        loanId,
        action: "delete",
        reason: "soft delete",
      });
    });

    try {
      const { enqueueGroupLoanChanged } =
        await import("$lib/server/jobs/queue");
      await enqueueGroupLoanChanged(loanId, {
        calendar: false,
        activity: {
          type: "loan_deleted",
          entityId: loanId,
          actorUserId: userId,
          actorEmail: session.user?.email ?? undefined,
          summary: `Loan deleted: ${deletedLoan?.loanName ?? "Loan"}`,
        },
      });
    } catch (notifyErr) {
      console.error("[email] loan deleted notify failed", notifyErr);
    }

    invalidateLoanData();
    scheduleDrain(event);
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting loan:", error);
    return json({ error: "Failed to delete loan" }, { status: 500 });
  }
};
