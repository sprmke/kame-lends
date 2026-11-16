import { calculateInterest } from "$lib/calculations";
import { buildLoanLedger } from "$lib/money/ledger";
import { centavosToPesos } from "$lib/money/centavos";
import {
  formatCurrency,
  formatDate,
  formatRateLabel,
  formatCount,
} from "$lib/format";
import type { InterestPeriodStatus } from "$lib/types";
import type { PaymentReceipt } from "$lib/payment-receipts";
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
  receipts?: PaymentReceipt[];
  notes?: string | null;
}

export interface ReceivedPaymentDisplay {
  id?: number;
  amount: string;
  receivedDate: string;
  interestPeriodId?: number | null;
  receipts?: PaymentReceipt[];
  notes?: string | null;
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
  periodExpectedById: Map<number, number>;
  /** Ledger-paid amount per period, including unlinked money allocated to it. */
  periodPaidById: Map<number, number>;
  receivedPayments: ReceivedPaymentDisplay[];
  unlinkedPayments: ReceivedPaymentDisplay[];
}

export function computeInvestorMetrics(
  item: InvestorWithTransactions,
  loanTotalPrincipal: number,
): InvestorMetrics {
  const { transactions } = item;

  const hasMultiplePeriods =
    !!item.hasMultipleInterest &&
    !!item.interestPeriods &&
    item.interestPeriods.length > 1;

  // One engine: the investor's schedule, grouped within this loan.
  const ledger = buildLoanLedger({
    dueDate: "9999-12-31",
    loanInvestors: transactions.map((transaction, index) => ({
      id: typeof transaction.id === "number" ? transaction.id : undefined,
      investorId: item.investor.id,
      investor: item.investor,
      amount: transaction.amount,
      interestRate:
        transaction.interestType === "fixed"
          ? transaction.interestRate
          : transaction.interestRate,
      interestType: transaction.interestType === "fixed" ? "fixed" : "rate",
      sentDate: transaction.sentDate,
      isPaid: transaction.isPaid,
      hasMultipleInterest: item.hasMultipleInterest,
      interestPeriods:
        index === 0 && item.interestPeriods
          ? item.interestPeriods.map((period) => ({
              id: typeof period.id === "number" ? period.id : undefined,
              dueDate: period.dueDate,
              interestRate:
                period.interestType === "fixed"
                  ? (period.interestAmount ?? period.interestRate)
                  : period.interestRate,
              interestType: period.interestType === "fixed" ? "fixed" : "rate",
              status: period.status ?? undefined,
            }))
          : [],
      receivedPayments:
        index === 0
          ? (item.receivedPayments ?? []).map((payment) => ({
              id: payment.id,
              interestPeriodId: payment.interestPeriodId ?? null,
              amount: payment.amount,
              receivedDate: payment.receivedDate,
            }))
          : [],
    })),
  });
  const investorLedger = ledger.investors[0];
  const totalCapital = centavosToPesos(investorLedger?.capitalC ?? 0);
  const totalInterest = centavosToPesos(investorLedger?.interestExpectedC ?? 0);
  const grandTotal = centavosToPesos(investorLedger?.dueC ?? 0);

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
  const totalReceived = centavosToPesos(investorLedger?.receivedC ?? 0);
  const balance = centavosToPesos(investorLedger?.balanceC ?? 0);
  const isFullyReceived =
    (investorLedger?.balanceC ?? 0) <= 0 && totalReceived > 0;
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

  const periodExpectedById = new Map<number, number>(
    (investorLedger?.periods ?? [])
      .filter((period) => period.id != null)
      .map((period) => [
        period.id as number,
        centavosToPesos(period.expectedC),
      ]),
  );

  const periodPaidById = new Map<number, number>(
    (investorLedger?.periods ?? [])
      .filter((period) => period.id != null)
      .map((period) => [period.id as number, centavosToPesos(period.paidC)]),
  );

  const unlinkedPayments = receivedPayments.filter(
    (payment) => payment.interestPeriodId == null,
  );

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
    periodExpectedById,
    periodPaidById,
    receivedPayments,
    unlinkedPayments,
  };
}

export function sectionKey(
  investorId: number,
  section: "principal" | "interest",
): string {
  return `${investorId}-${section}`;
}

export { formatCount, formatCurrency };
