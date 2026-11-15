import { memoryCacheInvalidatePrefix } from "$lib/server/memory-cache";
import { bumpCacheEpoch } from "$lib/server/cache-epoch";

/** Cache tag names kept for API compatibility. */
export const CACHE_TAGS = {
  loans: "loans",
  investors: "investors",
  borrowers: "borrowers",
  witnesses: "witnesses",
  debts: "debts",
  transactions: "transactions",
  dashboard: "dashboard",
  groups: "groups",
} as const;

function drop(prefixes: string[]): void {
  for (const prefix of prefixes) memoryCacheInvalidatePrefix(prefix);
}

export function invalidateLoanData() {
  drop(["loans:", "dashboard:", "groups:"]);
  // Other Vercel isolates pick this up on their next read.
  void bumpCacheEpoch("loans");
}

export function invalidateInvestorData() {
  drop([
    "investors:",
    "loans:",
    "dashboard:",
    "debts:",
    "transactions:",
    "groups:",
  ]);
  void bumpCacheEpoch("loans");
  void bumpCacheEpoch("investors");
}

export function invalidateBorrowerData() {
  drop(["borrowers:", "loans:", "dashboard:", "groups:"]);
  void bumpCacheEpoch("loans");
  void bumpCacheEpoch("borrowers");
}

export function invalidateWitnessData() {
  drop(["witnesses:", "loans:", "dashboard:", "groups:"]);
  void bumpCacheEpoch("loans");
  void bumpCacheEpoch("witnesses");
}

export function invalidateDebtData() {
  drop(["debts:", "dashboard:"]);
  void bumpCacheEpoch("debts");
}

export function invalidateTransactionData() {
  drop(["transactions:", "dashboard:", "investors:"]);
}

export function invalidateGroupData() {
  drop(["groups:"]);
}
