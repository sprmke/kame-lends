import { invalidate } from "$app/navigation";
import { page } from "$app/state";
import {
  clearLoanClientCaches,
  fetchLoanDetailClient,
} from "$lib/composables/loan-detail-client-cache";
import type { LoanWithInvestors } from "$lib/types";

export type LoanListChange =
  | { kind: "reload" }
  | { kind: "upsert"; loanId: number }
  | { kind: "replace"; loan: LoanWithInvestors }
  | { kind: "remove"; loanId: number };

/** Re-run loan list loads and return fresh rows. Use `page.data` after invalidate — destructured `data` from `$props()` can be stale in async handlers. */
export async function refreshLoanList(
  depends = "app:loans",
): Promise<LoanWithInvestors[]> {
  clearLoanClientCaches();
  await invalidate(depends);
  return (await page.data.loans) as LoanWithInvestors[];
}

export async function applyLoanListChange(
  current: LoanWithInvestors[],
  change: LoanListChange,
  options?: { depends?: string },
): Promise<LoanWithInvestors[]> {
  const depends = options?.depends ?? "app:loans";
  if (change.kind === "reload") {
    return refreshLoanList(depends);
  }
  if (change.kind === "remove") {
    clearLoanClientCaches(change.loanId);
    return current.filter((row) => row.id !== change.loanId);
  }

  if (change.kind === "replace") {
    return patchLoanRow(current, change.loan);
  }

  clearLoanClientCaches(change.loanId);
  const payload = await fetchLoanDetailClient(change.loanId);
  if (!payload) return refreshLoanList(depends);
  const { paymentMethods: _methods, access: _access, ...rest } = payload;
  return patchLoanRow(current, rest as LoanWithInvestors);
}

function patchLoanRow(
  current: LoanWithInvestors[],
  nextRow: LoanWithInvestors,
): LoanWithInvestors[] {
  const index = current.findIndex((row) => row.id === nextRow.id);
  if (index < 0) return [...current, nextRow];
  const next = [...current];
  next[index] = { ...current[index], ...nextRow };
  return next;
}
