import { downloadBlob } from "$lib/pdf-export";
import type {
  InvestorWithLoans,
  LoanWithInvestors,
  TransactionWithInvestor,
} from "$lib/types";

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
    throw new Error("Failed to generate PDF");
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
    const raw = (await response.text()).trim();
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; detail?: string };
      detail = parsed.detail || parsed.error || raw;
    } catch {
      /* plain text body */
    }
    if (response.status === 401) {
      throw new Error("Sign in again to download the contract.");
    }
    if (response.status === 404) {
      throw new Error("Loan not found or you do not have access.");
    }
    const shortDetail =
      detail && detail.length < 160 && !detail.includes("\n") ? detail : "";
    throw new Error(shortDetail || "Failed to generate contract PDF");
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
