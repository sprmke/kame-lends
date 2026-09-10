import { memoryCacheInvalidatePrefix } from "$lib/server/memory-cache";

/** Cache tag names kept for API compatibility. */
export const CACHE_TAGS = {
  loans: "loans",
  investors: "investors",
  borrowers: "borrowers",
  witnesses: "witnesses",
  debts: "debts",
  transactions: "transactions",
  dashboard: "dashboard",
} as const;

function drop(prefixes: string[]): void {
  for (const prefix of prefixes) memoryCacheInvalidatePrefix(prefix);
}

export function invalidateLoanData() {
  drop(["loans:", "dashboard:"]);
}

export function invalidateInvestorData() {
  drop(["investors:", "loans:", "dashboard:", "debts:", "transactions:"]);
}

export function invalidateBorrowerData() {
  drop(["borrowers:", "loans:", "dashboard:"]);
}

export function invalidateWitnessData() {
  drop(["witnesses:"]);
}

export function invalidateDebtData() {
  drop(["debts:", "dashboard:"]);
}

export function invalidateTransactionData() {
  drop(["transactions:", "dashboard:", "investors:"]);
}
