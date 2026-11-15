/**
 * The single money engine for a loan.
 *
 * Every screen, PDF, CSV, calendar event, Telegram message, and API route
 * should read totals from `buildLoanLedger`. The engine works in integer
 * centavos (`./centavos`) and groups allocations by investor **within one
 * loan**, so two loans for the same investor never share a schedule.
 *
 * Decisions implemented here (see `docs/architecture/money-model.md`):
 * - D-1/D-4: an investor's rate uses their total disbursed capital for this
 *   loan; a zero-capital (agent) allocation uses the loan principal.
 * - D-2: overdue starts the day after the due date, in Asia/Manila.
 * - D-3: each period's interest is rounded once to the centavo.
 * - D-5: a fixed period amount is charged once per investor per period.
 * - D-10: period status is derived from linked payments, never stored blindly.
 * - D-13/D-14: an unlinked payment is allocated to the oldest open interest
 *   first, then principal. Nothing is ever deleted.
 */
import { addC, mulRate, roundHalfUp, toCentavos } from "./centavos";
import {
  isAfterDueDate,
  toDateKey,
  todayKey as defaultTodayKey,
} from "$lib/dates/business-date";
import type { InterestPeriodStatus, LoanStatus } from "$lib/types";
import { deriveLoanStatus } from "./status";

export type LedgerInterestType = "rate" | "fixed";

export interface LedgerPeriodInput {
  id?: number | null;
  deletedAt?: Date | string | null;
  dueDate: Date | string;
  interestRate: string | number;
  interestType?: LedgerInterestType | string | null;
  status?: string | null;
}

export interface LedgerPaymentInput {
  id?: number | null;
  deletedAt?: Date | string | null;
  interestPeriodId?: number | null;
  amount: string | number;
  receivedDate?: Date | string | null;
}

export interface LedgerAllocationInput {
  id?: number | null;
  deletedAt?: Date | string | null;
  investorId?: number;
  investor?: { id?: number; name?: string } | null;
  amount: string | number;
  interestRate: string | number;
  interestType?: LedgerInterestType | string | null;
  sentDate?: Date | string | null;
  isPaid?: boolean | null;
  hasMultipleInterest?: boolean | null;
  interestPeriods?: LedgerPeriodInput[] | null;
  receivedPayments?: LedgerPaymentInput[] | null;
}

export interface LedgerLoanInput {
  id?: number | null;
  dueDate: Date | string;
  status?: string | null;
  loanInvestors: LedgerAllocationInput[];
}

export interface LedgerPeriod {
  id: number | null;
  dueDateKey: string;
  rate: number;
  interestType: LedgerInterestType;
  expectedC: number;
  paidC: number;
  remainingC: number;
  status: InterestPeriodStatus;
}

export interface LedgerInvestor {
  investorId: number;
  name: string;
  allocationIds: number[];
  capitalC: number;
  dueC: number;
  receivedC: number;
  interestExpectedC: number;
  interestPaidC: number;
  principalPaidC: number;
  balanceC: number;
  overdueC: number;
  periods: LedgerPeriod[];
  nextDueKey: string | null;
  isFullyDisbursed: boolean;
}

export interface LedgerDueRow {
  dateKey: string;
  principalC: number;
  interestC: number;
  totalC: number;
  investors: Array<{
    investorId: number;
    name: string;
    principalC: number;
    interestC: number;
    amountC: number;
  }>;
}

export interface LedgerInterestRow {
  dateKey: string;
  investorId: number;
  name: string;
  periodId: number | null;
  interestC: number;
}

export interface LoanLedger {
  loanId: number | null;
  todayKey: string;
  dueDateKey: string;
  status: LoanStatus;
  principalC: number;
  interestExpectedC: number;
  dueC: number;
  receivedC: number;
  interestPaidC: number;
  principalPaidC: number;
  balanceC: number;
  overdueC: number;
  nextDueKey: string | null;
  investors: LedgerInvestor[];
  dueRows: LedgerDueRow[];
  interestRows: LedgerInterestRow[];
}

function moneyC(value: string | number | null | undefined): number {
  return toCentavos(value);
}

function interestTypeOf(value: string | null | undefined): LedgerInterestType {
  return value === "fixed" ? "fixed" : "rate";
}

function investorIdOf(allocation: LedgerAllocationInput): number {
  return allocation.investor?.id ?? allocation.investorId ?? 0;
}

function nameOf(allocation: LedgerAllocationInput): string {
  return allocation.investor?.name ?? "";
}

/** Interest for one period, rounded once (D-3). */
function periodInterestC(
  baseC: number,
  rate: string | number,
  type: string | null | undefined,
): number {
  return interestTypeOf(type) === "fixed" ? moneyC(rate) : mulRate(baseC, rate);
}

function groupByInvestor(
  allocations: LedgerAllocationInput[],
): Map<number, LedgerAllocationInput[]> {
  const groups = new Map<number, LedgerAllocationInput[]>();
  for (const allocation of allocations) {
    const id = investorIdOf(allocation);
    const group = groups.get(id);
    if (group) group.push(allocation);
    else groups.set(id, [allocation]);
  }
  return groups;
}

function choosePeriods(
  allocations: LedgerAllocationInput[],
): LedgerPeriodInput[] {
  const withPeriods = allocations.find(
    (allocation) =>
      allocation.hasMultipleInterest &&
      (allocation.interestPeriods?.length ?? 0) > 0,
  );
  return [...(withPeriods?.interestPeriods ?? [])]
    .filter((period) => !period.deletedAt)
    .sort((a, b) => toDateKey(a.dueDate).localeCompare(toDateKey(b.dueDate)));
}

function derivePeriodStatus(
  paidC: number,
  expectedC: number,
  dueDateKey: string,
  today: string,
): InterestPeriodStatus {
  if (expectedC > 0 && paidC >= expectedC) return "Completed";
  if (paidC > 0) return "Incomplete";
  return isAfterDueDate(dueDateKey, today) ? "Overdue" : "Pending";
}

/**
 * Build every money value for one loan. `today` is a date key; pass it in
 * tests so results never depend on the clock.
 */
export function buildLoanLedger(
  loan: LedgerLoanInput,
  options: { today?: string; statusOverride?: LoanStatus | null } = {},
): LoanLedger {
  const today = options.today ?? defaultTodayKey();
  const dueDateKey = toDateKey(loan.dueDate);
  const activeAllocations = loan.loanInvestors.filter(
    (allocation) => !allocation.deletedAt,
  );
  const principalC = addC(
    ...activeAllocations.map((allocation) => moneyC(allocation.amount)),
  );

  const investors: LedgerInvestor[] = [];
  const dueByDate = new Map<string, LedgerDueRow>();
  const interestRows: LedgerInterestRow[] = [];

  const addDue = (
    dateKey: string,
    investorId: number,
    name: string,
    principalPartC: number,
    interestC: number,
  ) => {
    const existing = dueByDate.get(dateKey) ?? {
      dateKey,
      principalC: 0,
      interestC: 0,
      totalC: 0,
      investors: [],
    };
    existing.principalC += principalPartC;
    existing.interestC += interestC;
    existing.totalC += principalPartC + interestC;
    existing.investors.push({
      investorId,
      name,
      principalC: principalPartC,
      interestC,
      amountC: principalPartC + interestC,
    });
    dueByDate.set(dateKey, existing);
  };

  for (const [investorId, allocations] of groupByInvestor(loan.loanInvestors)) {
    const capitalC = addC(
      ...allocations.map((allocation) => moneyC(allocation.amount)),
    );
    const name = nameOf(allocations[0]);
    const allocationIds = allocations
      .map((allocation) => allocation.id)
      .filter((id): id is number => typeof id === "number");
    const isFullyDisbursed = allocations.every(
      (allocation) => allocation.isPaid !== false,
    );
    const payments = allocations
      .filter((allocation) => !allocation.deletedAt)
      .flatMap((allocation) => allocation.receivedPayments ?? [])
      .filter((payment) => !payment.deletedAt);
    const receivedC = addC(
      ...payments.map((payment) => moneyC(payment.amount)),
    );
    const periods = choosePeriods(allocations);
    const multi = periods.length > 0;

    let interestExpectedC: number;
    let interestPaidC: number;
    let principalPaidC: number;
    let overdueC = 0;
    let nextDueKey: string | null = null;
    const ledgerPeriods: LedgerPeriod[] = [];

    if (multi) {
      const baseC = capitalC === 0 ? principalC : capitalC;

      const linkedByPeriod = new Map<number, number>();
      let unlinkedC = 0;
      for (const payment of payments) {
        const periodId = payment.interestPeriodId;
        if (typeof periodId === "number") {
          linkedByPeriod.set(
            periodId,
            (linkedByPeriod.get(periodId) ?? 0) + moneyC(payment.amount),
          );
        } else {
          unlinkedC += moneyC(payment.amount);
        }
      }

      const expectedByPeriod = periods.map((period) =>
        periodInterestC(baseC, period.interestRate, period.interestType),
      );
      interestExpectedC = addC(...expectedByPeriod);

      // D-14: unlinked money pays the oldest open interest first.
      const paidByPeriod = periods.map((period, index) => {
        const linked =
          period.id != null ? (linkedByPeriod.get(period.id) ?? 0) : 0;
        const remaining = Math.max(expectedByPeriod[index] - linked, 0);
        const applied = Math.min(remaining, unlinkedC);
        unlinkedC -= applied;
        return linked + applied;
      });
      // Leftover unlinked money is a principal repayment.
      interestPaidC = addC(
        ...paidByPeriod.map((paid, index) =>
          Math.min(paid, expectedByPeriod[index]),
        ),
      );
      principalPaidC = Math.max(receivedC - interestPaidC, 0);

      periods.forEach((period, index) => {
        const dueKey = toDateKey(period.dueDate);
        const paidC = paidByPeriod[index];
        const expectedC = expectedByPeriod[index];
        const status = derivePeriodStatus(paidC, expectedC, dueKey, today);
        const remainingC = Math.max(expectedC - paidC, 0);
        ledgerPeriods.push({
          id: period.id ?? null,
          dueDateKey: dueKey,
          rate: Number(period.interestRate) || 0,
          interestType: interestTypeOf(period.interestType),
          expectedC,
          paidC,
          remainingC,
          status,
        });
        if (remainingC > 0 && nextDueKey === null) nextDueKey = dueKey;
        if (isAfterDueDate(dueKey, today) && status !== "Completed") {
          overdueC += remainingC;
        }
      });

      const unpaidPrincipalC = Math.max(capitalC - principalPaidC, 0);
      if (isAfterDueDate(dueDateKey, today)) {
        overdueC += unpaidPrincipalC;
      }

      // Schedule rows: the final period carries principal plus any unpaid
      // earlier interest. Completed interest keeps its own row.
      let rolledInterestC = 0;
      ledgerPeriods.forEach((period, index) => {
        const isFinal = index === ledgerPeriods.length - 1;
        if (isFinal) {
          if (period.status === "Completed") {
            interestRows.push({
              dateKey: period.dueDateKey,
              investorId,
              name,
              periodId: period.id,
              interestC: period.expectedC,
            });
            addDue(
              period.dueDateKey,
              investorId,
              name,
              capitalC,
              rolledInterestC,
            );
          } else {
            addDue(
              period.dueDateKey,
              investorId,
              name,
              capitalC,
              period.expectedC + rolledInterestC,
            );
          }
          return;
        }

        if (period.status === "Overdue" || period.status === "Incomplete") {
          rolledInterestC += period.expectedC;
          return;
        }

        interestRows.push({
          dateKey: period.dueDateKey,
          investorId,
          name,
          periodId: period.id,
          interestC: period.expectedC,
        });
      });
    } else {
      interestExpectedC = addC(
        ...allocations.map((allocation) => {
          const trancheC = moneyC(allocation.amount);
          const baseC = trancheC === 0 ? principalC : trancheC;
          return periodInterestC(
            baseC,
            allocation.interestRate,
            allocation.interestType,
          );
        }),
      );
      interestPaidC = Math.min(receivedC, interestExpectedC);
      principalPaidC = Math.max(receivedC - interestPaidC, 0);
      nextDueKey = capitalC - principalPaidC > 0 ? dueDateKey : null;
      if (isAfterDueDate(dueDateKey, today)) {
        overdueC = Math.max(capitalC + interestExpectedC - receivedC, 0);
      }
      addDue(dueDateKey, investorId, name, capitalC, interestExpectedC);
    }

    const dueC = capitalC + interestExpectedC;
    const balanceC = dueC - receivedC;
    investors.push({
      investorId,
      name,
      allocationIds,
      capitalC,
      dueC,
      receivedC,
      interestExpectedC,
      interestPaidC,
      principalPaidC,
      balanceC,
      overdueC,
      periods: ledgerPeriods,
      nextDueKey,
      isFullyDisbursed,
    });
  }

  const total = (pick: (investor: LedgerInvestor) => number) =>
    addC(...investors.map(pick));

  const dueC = total((investor) => investor.dueC);
  const receivedC = total((investor) => investor.receivedC);
  const balanceC = dueC - receivedC;
  const overdueC = total((investor) => investor.overdueC);

  const derivedStatus = deriveLoanStatus({
    balanceC,
    overdueC,
    hasUnpaidDisbursement: investors.some(
      (investor) => !investor.isFullyDisbursed,
    ),
    override: options.statusOverride ?? null,
  });
  const status = derivedStatus;

  const nextDueKey =
    investors
      .map((investor) => investor.nextDueKey)
      .filter((key): key is string => key !== null)
      .sort()[0] ?? null;

  return {
    loanId: loan.id ?? null,
    todayKey: today,
    dueDateKey,
    status,
    principalC,
    interestExpectedC: total((investor) => investor.interestExpectedC),
    dueC,
    receivedC,
    interestPaidC: total((investor) => investor.interestPaidC),
    principalPaidC: total((investor) => investor.principalPaidC),
    balanceC,
    overdueC,
    nextDueKey,
    investors,
    dueRows: [...dueByDate.values()].sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    ),
    interestRows: interestRows.sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    ),
  };
}

/** Convenience: lead-time status for a single investor in a single loan. */
export function investorLedger(
  ledger: LoanLedger,
  investorId: number,
): LedgerInvestor | undefined {
  return ledger.investors.find(
    (investor) => investor.investorId === investorId,
  );
}

/** Sum two ledger values safely (used by report aggregates). */
export function sumLedgers(ledgers: LoanLedger[]): {
  principalC: number;
  interestExpectedC: number;
  dueC: number;
  receivedC: number;
  balanceC: number;
  overdueC: number;
} {
  return {
    principalC: addC(...ledgers.map((ledger) => ledger.principalC)),
    interestExpectedC: addC(
      ...ledgers.map((ledger) => ledger.interestExpectedC),
    ),
    dueC: addC(...ledgers.map((ledger) => ledger.dueC)),
    receivedC: addC(...ledgers.map((ledger) => ledger.receivedC)),
    balanceC: addC(...ledgers.map((ledger) => ledger.balanceC)),
    overdueC: addC(...ledgers.map((ledger) => ledger.overdueC)),
  };
}

export { roundHalfUp };
