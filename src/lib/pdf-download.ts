import { downloadBlob } from "$lib/pdf-export";
import type {
  InvestorWithLoans,
  LoanWithInvestors,
  TransactionWithInvestor,
} from "$lib/types";

/**
 * Parses a failed PDF response body (JSON `{ error, detail }` or plain text)
 * into a short, user-safe message. `statusMessages` lets a caller override the
 * message for specific status codes (e.g. 404 means different things for a
 * single contract vs. a list export).
 */
async function extractPdfErrorMessage(
  response: Response,
  statusMessages: Partial<Record<number, string>> = {},
): Promise<string> {
  if (statusMessages[response.status]) {
    return statusMessages[response.status]!;
  }
  const raw = (await response.text().catch(() => "")).trim();
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string; detail?: string };
    message = parsed.error || parsed.detail || raw;
  } catch {
    /* plain text body */
  }
  const isShortAndSafe =
    message && message.length < 200 && !message.includes("\n");
  return isShortAndSafe ? message : "Failed to generate PDF";
}

const DEFAULT_PDF_STATUS_MESSAGES: Partial<Record<number, string>> = {
  401: "Sign in again to download this file.",
};

async function downloadPdfFromApi(
  endpoint: string,
  body: Record<string, unknown>,
  fallbackFilename: string,
): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      await extractPdfErrorMessage(response, DEFAULT_PDF_STATUS_MESSAGES),
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;
  downloadBlob(blob, filename);
}

export async function downloadLoansPdf(
  data: LoanWithInvestors[],
  enabledSectionKeys: string[],
  investorId?: number,
): Promise<void> {
  await downloadPdfFromApi(
    "/api/export/loans",
    { data, enabledSectionKeys, investorId },
    "loans.pdf",
  );
}

export async function downloadInvestorsPdf(
  data: InvestorWithLoans[],
  enabledSectionKeys: string[],
): Promise<void> {
  await downloadPdfFromApi(
    "/api/export/investors",
    { data, enabledSectionKeys },
    "investors.pdf",
  );
}

export async function downloadTransactionsPdf(
  data: TransactionWithInvestor[],
  enabledSectionKeys: string[],
): Promise<void> {
  await downloadPdfFromApi(
    "/api/export/transactions",
    { data, enabledSectionKeys },
    "transactions.pdf",
  );
}

export async function downloadLoanContractPdf(loanId: number): Promise<void> {
  const response = await fetch(`/api/loans/${loanId}/contract`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      await extractPdfErrorMessage(response, {
        401: "Sign in again to download the contract.",
        404: "Loan not found or you do not have access.",
      }),
    );
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `loan-contract-${loanId}.pdf`;
  const { shareOrDownloadFile } = await import("$lib/pwa/share");
  const outcome = await shareOrDownloadFile({
    blob,
    filename,
    title: filename,
  });
  if (outcome === "failed") {
    downloadBlob(blob, filename);
  }
}
