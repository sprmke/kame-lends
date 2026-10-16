import { calculateInterest } from "$lib/calculations";

export interface SuggestablePeriod {
  id: number;
  dueDate: Date | string;
  interestRate: string;
  interestType?: string | null;
  status: string;
}

const TOLERANCE = 0.02;

/**
 * Conservative: picks an interest period only when the received amount equals that
 * period's interest due (±₱0.02) and the period is not completed. Earliest due wins.
 * Anything else stays on the general loan balance.
 */
export function suggestInterestPeriodId(
  amount: number | null,
  periods: SuggestablePeriod[],
  investorCapital: number,
): string {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return "general";
  }
  const match = periods
    .filter((period) => period.status !== "Completed")
    .filter((period) => {
      const due = calculateInterest(
        investorCapital,
        period.interestRate,
        period.interestType ?? undefined,
      );
      return due > 0 && Math.abs(due - amount) <= TOLERANCE;
    })
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )[0];
  return match ? String(match.id) : "general";
}
