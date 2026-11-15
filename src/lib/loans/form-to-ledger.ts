/**
 * Adapter from loan-form state to the money engine (T2.8).
 *
 * The form, the contract draft, and the multiple-interest editor all read
 * totals from here. No component computes interest on its own.
 */
import type { SelectedInvestorAllocation } from "$lib/components/loans/loan-form-types";
import {
  buildLoanLedger,
  type LedgerLoanInput,
  type LoanLedger,
} from "$lib/money/ledger";
import { centavosToPesos } from "$lib/money/centavos";
import { calculateInterest } from "$lib/calculations";

const FAR_FUTURE = "9999-12-31";

function numericId(
  value: string | number | null | undefined,
): number | undefined {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

/** Form state → ledger input. Periods live on the investor's first tranche. */
export function toLedgerLoanInput(
  selectedInvestors: SelectedInvestorAllocation[],
  dueDate = FAR_FUTURE,
): LedgerLoanInput {
  const allocations = selectedInvestors.flatMap((si) =>
    si.transactions.map((transaction, index) => ({
      id: numericId(transaction.id),
      investorId: si.investor.id,
      investor: si.investor,
      amount: transaction.amount || "0",
      interestRate:
        transaction.interestType === "fixed"
          ? transaction.interestAmount || "0"
          : transaction.interestRate || "0",
      interestType: transaction.interestType,
      sentDate: transaction.sentDate,
      isPaid: transaction.isPaid,
      hasMultipleInterest: si.hasMultipleInterest,
      interestPeriods:
        index === 0 && si.hasMultipleInterest
          ? si.interestPeriods.map((period) => ({
              id: numericId(period.id),
              dueDate: period.dueDate,
              interestRate:
                period.interestType === "fixed"
                  ? period.interestAmount || "0"
                  : period.interestRate || "0",
              interestType: period.interestType,
              status: period.status,
            }))
          : [],
      receivedPayments:
        index === 0
          ? si.receivedPayments.map((payment) => ({
              id: numericId(payment.id),
              interestPeriodId: payment.interestPeriodId ?? null,
              amount: payment.amount || "0",
              receivedDate: payment.receivedDate,
            }))
          : [],
    })),
  );

  return { dueDate, loanInvestors: allocations };
}

export function buildFormLedger(
  selectedInvestors: SelectedInvestorAllocation[],
  options: { dueDate?: string; today?: string } = {},
): LoanLedger {
  return buildLoanLedger(
    toLedgerLoanInput(selectedInvestors, options.dueDate ?? FAR_FUTURE),
    { today: options.today },
  );
}

export interface FormPreviewRow {
  investorId: number;
  transactionId: string;
  capital: number;
  interest: number;
  interestRate: number;
  total: number;
}

/**
 * Per-disbursement preview. The investor's total starts from the ledger.
 * Single-interest tranches are exact; a multi-interest schedule is split
 * across the investor's tranches in proportion to capital (display only).
 */
export function formPreviewRows(
  selectedInvestors: SelectedInvestorAllocation[],
  options: { dueDate?: string; today?: string } = {},
): FormPreviewRow[] {
  const ledger = buildFormLedger(selectedInvestors, options);
  const rows: FormPreviewRow[] = [];

  for (const si of selectedInvestors) {
    const investorLedger = ledger.investors.find(
      (investor) => investor.investorId === si.investor.id,
    );
    if (!investorLedger) continue;

    const capitalTotal = centavosToPesos(investorLedger.capitalC);
    const interestTotal = centavosToPesos(investorLedger.interestExpectedC);

    if (si.hasMultipleInterest) {
      si.transactions.forEach((transaction, index) => {
        const capital = Number(transaction.amount) || 0;
        const share =
          capitalTotal > 0
            ? interestTotal * (capital / capitalTotal)
            : index === 0
              ? interestTotal
              : 0;
        rows.push({
          investorId: si.investor.id,
          transactionId: transaction.id,
          capital,
          interest: share,
          interestRate: capital > 0 ? (share / capital) * 100 : 0,
          total: capital + share,
        });
      });
      continue;
    }

    for (const transaction of si.transactions) {
      const capital = Number(transaction.amount) || 0;
      const base = capital === 0 ? centavosToPesos(ledger.principalC) : capital;
      const interest =
        transaction.interestType === "fixed"
          ? Number(transaction.interestAmount) || 0
          : calculateInterest(
              base,
              transaction.interestRate,
              transaction.interestType,
            );
      rows.push({
        investorId: si.investor.id,
        transactionId: transaction.id,
        capital,
        interest,
        interestRate: capital > 0 ? (interest / capital) * 100 : 0,
        total: capital + interest,
      });
    }
  }

  return rows;
}

/** Amount due for one investor in the form, from the ledger. */
export function formInvestorDue(
  selectedInvestors: SelectedInvestorAllocation[],
  investorId: number,
  options: { dueDate?: string; today?: string } = {},
): number {
  const ledger = buildFormLedger(selectedInvestors, options);
  const investor = ledger.investors.find(
    (row) => row.investorId === investorId,
  );
  return investor ? centavosToPesos(investor.dueC) : 0;
}

/** Total interest for a synthetic single-investor schedule (editor summary). */
export function formScheduleInterest(input: {
  capital: string | number;
  periods: Array<{
    interestRate: string;
    interestAmount: string;
    interestType: "rate" | "fixed";
  }>;
}): { interest: number; averageRate: number } {
  const capital = Number(input.capital) || 0;
  const ledger = buildLoanLedger({
    dueDate: FAR_FUTURE,
    loanInvestors: [
      {
        investorId: 1,
        investor: { id: 1, name: "Preview" },
        amount: String(capital),
        interestRate: "0",
        interestType: "rate",
        hasMultipleInterest: input.periods.length > 0,
        isPaid: true,
        interestPeriods: input.periods.map((period) => ({
          dueDate: FAR_FUTURE,
          interestRate:
            period.interestType === "fixed"
              ? period.interestAmount
              : period.interestRate,
          interestType: period.interestType,
        })),
      },
    ],
  });
  const interest = centavosToPesos(ledger.interestExpectedC);
  return {
    interest,
    averageRate: capital > 0 ? (interest / capital) * 100 : 0,
  };
}
