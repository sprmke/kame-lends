/**
 * The one loan status rule (D-2, D-7).
 *
 * - Money wins: fully received means Completed.
 * - Overdue starts the day after the due date in Asia/Manila. The ledger
 *   computes `overdueC` with that rule; this function only orders the states.
 * - A manual override (Completed with a reason) beats the derived value.
 * - Never mark a loan Completed while principal is still outstanding.
 */
import type { LoanStatus } from "$lib/types";

export interface LoanStatusInput {
  balanceC: number;
  overdueC: number;
  hasUnpaidDisbursement: boolean;
  override?: LoanStatus | null;
}

export function deriveLoanStatus(input: LoanStatusInput): LoanStatus {
  if (input.override) return input.override;
  if (input.balanceC <= 0) return "Completed";
  if (input.overdueC > 0) return "Overdue";
  if (input.hasUnpaidDisbursement) return "Partially Funded";
  return "Fully Funded";
}
