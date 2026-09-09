import { normalizeValidIdUrl } from "$lib/valid-id-document";

/** Shared payment-method limits (safe for client + server). */
export const MAX_PAYMENT_METHODS_PER_USER = 10;

export type PaymentMethodInput = {
  bankName?: unknown;
  accountNumber?: unknown;
  qrCodeUrl?: unknown;
};

export function parsePaymentMethodId(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

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
