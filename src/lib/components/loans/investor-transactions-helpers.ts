import { calculateInterest } from "$lib/calculations";
import {
  formatCurrency,
  formatDate,
  formatRateLabel,
  formatCount,
} from "$lib/format";
import type { InterestPeriodStatus } from "$lib/types";
import { toLocalDateString } from "$lib/date-utils";

export interface InterestPeriodDisplay {
  id?: number | string;
  dueDate: Date | string;
  interestRate: string;
  interestAmount?: string | null;
  interestType?: string;
  status?: InterestPeriodStatus | string | null;
}

export interface InvestorTransactionDisplay {
  id?: number | string;
  amount: string;
  interestRate: string;
  interestType?: string;
  sentDate: Date | string;
  isPaid: boolean;
}

export interface ReceivedPaymentDisplay {
  id?: number;
  amount: string;
  receivedDate: string;
  interestPeriodId?: number | null;
}

export interface InvestorWithTransactions {
  investor: { id: number; name: string; email?: string | null };
  transactions: InvestorTransactionDisplay[];
  receivedPayments?: ReceivedPaymentDisplay[];
  hasMultipleInterest?: boolean;
  interestPeriods?: InterestPeriodDisplay[];
}

const AMOUNT_MATCH_TOLERANCE = 0.02;

export function sumLinkedPaymentsForPeriod(
  receivedPayments: ReceivedPaymentDisplay[] | undefined,
  periodId: number,
): number {
  return (receivedPayments || [])
    .filter((rp) => rp.interestPeriodId === periodId)
    .reduce((s, rp) => s + (parseFloat(rp.amount) || 0), 0);
}

export function formatReceivedDatesCommaSeparated(
  rows: ReceivedPaymentDisplay[],
): string {
  return rows.map((r) => formatDate(r.receivedDate)).join(", ");
}

export function dateForPickerInput(receivedDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) return receivedDate;
  return toLocalDateString(new Date(receivedDate));
}

export function matchReceivedDatesToCompletedPeriods(
  periodsSortedByDue: InterestPeriodDisplay[],
  receivedPayments: ReceivedPaymentDisplay[],
  periodPrincipalBase: number,
): Map<number, string> {
  const pool = receivedPayments.map((rp) => ({
    amount: parseFloat(rp.amount) || 0,
    receivedDate: rp.receivedDate,
    used: false,
  }));

  const result = new Map<number, string>();

  for (const period of periodsSortedByDue) {
    if (period.status !== "Completed" || typeof period.id !== "number")
      continue;

    const expected = calculateInterest(
      periodPrincipalBase,
      period.interestRate,
      period.interestType,
    );
    const dueTime = new Date(period.dueDate).getTime();

    let bestIdx = -1;
    let bestScore = Infinity;

    for (let i = 0; i < pool.length; i++) {
      if (pool[i].used) continue;
      if (Math.abs(pool[i].amount - expected) > AMOUNT_MATCH_TOLERANCE)
        continue;
      const rpTime = new Date(pool[i].receivedDate).getTime();
      const score = Math.abs(rpTime - dueTime);
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      pool[bestIdx].used = true;
      result.set(period.id, pool[bestIdx].receivedDate);
    }
  }

  return result;
}

export function computeLoanTotalPrincipal(
  investors: InvestorWithTransactions[],
): number {
  return investors.reduce(
    (sum, item) =>
      sum +
      item.transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0),
    0,
  );
}

export interface InvestorMetrics {
  totalCapital: number;
  hasMultiplePeriods: boolean;
  totalInterest: number;
  grandTotal: number;
  anyFixed: boolean;
  rateDisplay: string;
  totalReceived: number;
  balance: number;
  isFullyReceived: boolean;
  receivedCount: number;
  principalCount: number;
  periodCount: number;
  periodPrincipalBase: number;
  sortedPeriodsForMatch: InterestPeriodDisplay[];
  periodReceivedDateById: Map<number, string>;
  receivedPayments: ReceivedPaymentDisplay[];
}

export function computeInvestorMetrics(
  item: InvestorWithTransactions,
  loanTotalPrincipal: number,
): InvestorMetrics {
  const { transactions } = item;

  const totalCapital = transactions.reduce(
    (sum, t) => sum + (parseFloat(t.amount) || 0),
    0,
  );

  const hasMultiplePeriods =
    !!item.hasMultipleInterest &&
    !!item.interestPeriods &&
    item.interestPeriods.length > 1;

  const totalInterest =
    hasMultiplePeriods && item.interestPeriods
      ? item.interestPeriods.reduce((sum, p) => {
          const rv = parseFloat(p.interestRate) || 0;
          if (p.interestType === "fixed") return sum + rv;
          const base = totalCapital === 0 ? loanTotalPrincipal : totalCapital;
          return sum + base * (rv / 100);
        }, 0)
      : transactions.reduce((sum, t) => {
          const capital = parseFloat(t.amount) || 0;
          const rv = parseFloat(t.interestRate) || 0;
          if (t.interestType === "fixed") return sum + rv;
          const base = capital === 0 ? loanTotalPrincipal : capital;
          return sum + base * (rv / 100);
        }, 0);

  const grandTotal = totalCapital + totalInterest;

  const anyFixed = hasMultiplePeriods
    ? (item.interestPeriods ?? []).some((p) => p.interestType === "fixed")
    : transactions.some((t) => t.interestType === "fixed");

  let rateDisplay: string;
  if (totalCapital > 0) {
    const pct = (totalInterest / totalCapital) * 100;
    rateDisplay = formatRateLabel(pct, { fixed: anyFixed });
  } else if (loanTotalPrincipal > 0 && totalInterest > 0) {
    const pct = (totalInterest / loanTotalPrincipal) * 100;
    rateDisplay = formatRateLabel(pct, { fixed: anyFixed });
  } else {
    rateDisplay = formatRateLabel(0);
  }

  const receivedPayments = item.receivedPayments ?? [];
  const totalReceived = receivedPayments.reduce(
    (sum, rp) => sum + (parseFloat(rp.amount) || 0),
    0,
  );
  const balance = grandTotal - totalReceived;
  const isFullyReceived = balance <= 0.01 && totalReceived > 0;
  const receivedCount = receivedPayments.length;
  const principalCount = transactions.length;
  const periodCount = item.interestPeriods?.length ?? 0;
  const periodPrincipalBase =
    totalCapital === 0 ? loanTotalPrincipal : totalCapital;

  const sortedPeriodsForMatch =
    hasMultiplePeriods && item.interestPeriods
      ? [...item.interestPeriods].sort(
          (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
        )
      : [];

  const periodReceivedDateById =
    hasMultiplePeriods && sortedPeriodsForMatch.length > 0
      ? matchReceivedDatesToCompletedPeriods(
          sortedPeriodsForMatch,
          receivedPayments,
          periodPrincipalBase,
        )
      : new Map<number, string>();

  return {
    totalCapital,
    hasMultiplePeriods,
    totalInterest,
    grandTotal,
    anyFixed,
    rateDisplay,
    totalReceived,
    balance,
    isFullyReceived,
    receivedCount,
    principalCount,
    periodCount,
    periodPrincipalBase,
    sortedPeriodsForMatch,
    periodReceivedDateById,
    receivedPayments,
  };
}

export function sectionKey(
  investorId: number,
  section: "principal" | "interest",
): string {
  return `${investorId}-${section}`;
}

export { formatCount, formatCurrency };
