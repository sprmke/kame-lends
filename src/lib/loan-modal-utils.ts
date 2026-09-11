import type { LoanWithInvestors } from "$lib/types";

export async function fetchFullLoan(
  loan: LoanWithInvestors,
): Promise<LoanWithInvestors> {
  try {
    const response = await fetch(`/api/loans/${loan.id}`);
    if (response.ok) return (await response.json()) as LoanWithInvestors;
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
) {
  void fetchFullLoan(source).then((full) => {
    if (getCurrent()?.id === source.id) setCurrent(full);
  });
}
