import {
  normalizePaymentProvider,
  validatePaymentAccountNumber,
  validatePaymentProvider,
} from "$lib/payment-providers";
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

  const providerError = validatePaymentProvider(bankName);
  if (providerError) return { error: providerError };

  const provider = normalizePaymentProvider(bankName);
  if (!accountNumber) return { error: "Account number is required" };

  const accountNumberError = validatePaymentAccountNumber(
    provider,
    accountNumber,
  );
  if (accountNumberError) return { error: accountNumberError };

  const qrCodeUrl = normalizeValidIdUrl(body.qrCodeUrl);
  if (body.qrCodeUrl != null && String(body.qrCodeUrl).trim() && !qrCodeUrl) {
    return { error: "QR code must be a JPEG, PNG, or WebP image" };
  }

  return { bankName: provider, accountNumber, qrCodeUrl };
}
