import { mulRate, toCentavos } from "$lib/money/centavos";

export interface SuggestablePeriod {
  id: number;
  dueDate: Date | string;
  interestRate: string;
  interestType?: string | null;
  status: string;
}

const TOLERANCE_CENTAVOS = 2;

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
      const dueC =
        period.interestType === "fixed"
          ? toCentavos(period.interestRate)
          : mulRate(toCentavos(investorCapital), period.interestRate);
      return (
        dueC > 0 && Math.abs(dueC - toCentavos(amount)) <= TOLERANCE_CENTAVOS
      );
    })
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )[0];
  return match ? String(match.id) : "general";
}
