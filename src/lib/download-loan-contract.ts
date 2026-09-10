import { downloadLoanContractPdf } from "$lib/pdf-download";
import { toast } from "$lib/toast";
import type { LoanWithInvestors } from "$lib/types";

export async function downloadLoanContract(
  loan: LoanWithInvestors,
): Promise<void> {
  try {
    await downloadLoanContractPdf(loan.id);
  } catch (error) {
    console.error("Error generating loan contract PDF:", error);
    toast.error("Failed to generate contract PDF.");
  }
}
