/**
 * Stored vs ledger-derived status drift (D-10, D-12).
 *
 * Pure: takes loan rows and returns mismatches. The status sweep and the
 * health report must use the same rule, otherwise the report cries wolf about
 * periods the ledger already considers paid through unlinked money.
 */
import type { InterestPeriodStatus, LoanStatus } from "$lib/types";
import { buildLoanLedger, type LedgerLoanInput } from "./ledger";

export interface StatusDriftLoan extends LedgerLoanInput {
  id: number;
  status: string;
  statusOverride?: string | null;
}

export interface PeriodStatusDrift {
  periodId: number;
  loanId: number;
  stored: string;
  derived: InterestPeriodStatus;
}

export interface LoanStatusDrift {
  loanId: number;
  stored: string;
  derived: LoanStatus;
}

export interface StatusDrift {
  periods: PeriodStatusDrift[];
  loans: LoanStatusDrift[];
}

export function collectStatusDrift(loans: StatusDriftLoan[]): StatusDrift {
  const periods: PeriodStatusDrift[] = [];
  const loanDrift: LoanStatusDrift[] = [];

  for (const loan of loans) {
    const storedById = new Map<number, string>();
    for (const allocation of loan.loanInvestors) {
      for (const period of allocation.interestPeriods ?? []) {
        if (period.id == null) continue;
        storedById.set(period.id, period.status ?? "Pending");
      }
    }

    const override =
      loan.statusOverride === "Completed" ? ("Completed" as const) : null;
    const ledger = buildLoanLedger(loan, { statusOverride: override });

    for (const investor of ledger.investors) {
      for (const period of investor.periods) {
        if (period.id == null) continue;
        const stored = storedById.get(period.id);
        if (stored == null || stored === period.status) continue;
        periods.push({
          periodId: period.id,
          loanId: loan.id,
          stored,
          derived: period.status,
        });
      }
    }

    if (loan.status !== ledger.status) {
      loanDrift.push({
        loanId: loan.id,
        stored: loan.status,
        derived: ledger.status,
      });
    }
  }

  return { periods, loans: loanDrift };
}
