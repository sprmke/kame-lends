import { db } from "$lib/server/db";
import { paymentMethods } from "$lib/server/db/schema";
import { eq, asc, count } from "drizzle-orm";
import type { LoanAccessContext } from "$lib/loan-access";
import type { PaymentMethod } from "$lib/types";
import {
  MAX_PAYMENT_METHODS_PER_USER,
  parsePaymentMethodId,
  parsePaymentMethodInput,
  type PaymentMethodInput,
} from "$lib/payment-methods";

export {
  MAX_PAYMENT_METHODS_PER_USER,
  parsePaymentMethodId,
  parsePaymentMethodInput,
  type PaymentMethodInput,
};

export type PaymentMethodRow = typeof paymentMethods.$inferSelect;

export function toPublicPaymentMethod(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    qrCodeUrl: row.qrCodeUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPaymentMethodsForUser(
  userId: string,
): Promise<PaymentMethod[]> {
  try {
    const rows = await db.query.paymentMethods.findMany({
      where: eq(paymentMethods.userId, userId),
      orderBy: [asc(paymentMethods.id)],
    });
    return rows.map(toPublicPaymentMethod);
  } catch (error) {
    console.error("Failed to list payment methods", error);
    return [];
  }
}

/**
 * Borrowers on a loan may see the loan owner's payment methods.
 * Owners, investors, and witnesses do not receive these via loan detail APIs.
 */
export async function listPaymentMethodsForBorrowerLoanView(
  loanOwnerUserId: string,
  access: LoanAccessContext,
): Promise<PaymentMethod[]> {
  if (!access.memberships.includes("borrower")) return [];
  return listPaymentMethodsForUser(loanOwnerUserId);
}

/** Any signed-in user may manage their own payment methods in Settings. */
export async function canManagePaymentMethods(
  _userId: string,
): Promise<boolean> {
  return true;
}

export async function countPaymentMethodsForUser(
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, userId));
  return Number(row?.value ?? 0);
}

export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}
