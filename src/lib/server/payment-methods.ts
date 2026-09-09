import { db } from "$lib/server/db";
import { paymentMethods } from "$lib/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { normalizeValidIdUrl } from "$lib/valid-id-document";
import type { LoanAccessContext } from "$lib/loan-access";
import type { PaymentMethod } from "$lib/types";

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
  const rows = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.userId, userId),
    orderBy: [asc(paymentMethods.id)],
  });
  return rows.map(toPublicPaymentMethod);
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

export type PaymentMethodInput = {
  bankName?: unknown;
  accountNumber?: unknown;
  qrCodeUrl?: unknown;
};

export function parsePaymentMethodInput(body: PaymentMethodInput):
  | {
      bankName: string;
      accountNumber: string;
      qrCodeUrl: string | null;
    }
  | { error: string } {
  const bankName =
    typeof body.bankName === "string" ? body.bankName.trim() : "";
  const accountNumber =
    typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";

  if (!bankName) return { error: "Bank name is required" };
  if (bankName.length > 120) return { error: "Bank name is too long" };
  if (!accountNumber) return { error: "Account number is required" };
  if (accountNumber.length > 64) return { error: "Account number is too long" };

  const qrCodeUrl = normalizeValidIdUrl(body.qrCodeUrl);
  if (body.qrCodeUrl != null && String(body.qrCodeUrl).trim() && !qrCodeUrl) {
    return { error: "QR code must be a JPEG, PNG, or WebP image" };
  }

  return { bankName, accountNumber, qrCodeUrl };
}
