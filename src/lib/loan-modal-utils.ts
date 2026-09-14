import type { LoanWithInvestors } from "$lib/types";
import {
  clearLoanClientCaches,
  fetchLoanDetailClient,
} from "$lib/composables/loan-detail-client-cache";

export async function fetchFullLoan(
  loan: LoanWithInvestors,
  options: { includeContract?: boolean } = {},
): Promise<LoanWithInvestors> {
  try {
    const payload = await fetchLoanDetailClient(loan.id, options);
    if (payload) {
      const { paymentMethods: _methods, access: _access, ...rest } = payload;
      return rest as LoanWithInvestors;
    }
  } catch {
    // Fall back to list row data.
  }
  return loan;
}

/** Refresh a loan in place when the target slot still shows the same loan id. */
export function refreshLoanIfCurrent(
  getCurrent: () => LoanWithInvestors | null,
  setCurrent: (loan: LoanWithInvestors) => void,
  source: LoanWithInvestors,
  options: { includeContract?: boolean } = {},
) {
  void fetchFullLoan(source, options).then((full) => {
    if (getCurrent()?.id === source.id) setCurrent(full);
  });
}

export function forgetCachedLoan(loanId: number): void {
  clearLoanClientCaches(loanId);
}
