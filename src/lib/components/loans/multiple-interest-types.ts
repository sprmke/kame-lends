export interface InterestPeriodData {
  id: string;
  dueDate: string;
  interestRate: string;
  interestAmount: string;
  interestType: "rate" | "fixed";
  status?: "Pending" | "Incomplete" | "Completed" | "Overdue";
}

export function sortInterestPeriodsByDueDate(
  periods: InterestPeriodData[],
): InterestPeriodData[] {
  if (periods.length <= 1) return periods;
  const finalPeriod = periods[periods.length - 1];
  const intermediatePeriods = periods.slice(0, -1);
  const sortedIntermediate = [...intermediatePeriods].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  return [...sortedIntermediate, finalPeriod];
}

export function hasDuplicateInterestDueDates(
  periods: InterestPeriodData[],
): boolean {
  const dates = periods.map((p) => p.dueDate).filter(Boolean);
  return new Set(dates).size !== dates.length;
}

/** True when the period has the value its type needs (rate or fixed > 0). */
export function hasPeriodValue(period: InterestPeriodData): boolean {
  const raw =
    period.interestType === "fixed"
      ? period.interestAmount
      : period.interestRate;
  const text = String(raw ?? "").trim();
  if (!text) return false;
  const value = Number(text);
  return Number.isFinite(value) && value > 0;
}
