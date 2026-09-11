import { invalidate } from "$app/navigation";
import { page } from "$app/state";
import type { LoanWithInvestors } from "$lib/types";

/** Re-run loan list loads and return fresh rows. Use `page.data` after invalidate — destructured `data` from `$props()` can be stale in async handlers. */
export async function refreshLoanList(): Promise<LoanWithInvestors[]> {
  await invalidate("app:loans");
  return (await page.data.loans) as LoanWithInvestors[];
}
