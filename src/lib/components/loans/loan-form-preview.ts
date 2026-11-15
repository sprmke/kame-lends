import type { LoanStatus, Investor } from "$lib/types";
import type { LoanContractDraftInput } from "$lib/loan-contract-data";
import type { SelectedInvestorAllocation } from "$lib/components/loans/loan-form-types";
import type { InvestorWithTransactions } from "./investor-transactions-helpers";
import { buildFormLedger, formPreviewRows } from "$lib/loans/form-to-ledger";
import { centavosToPesos } from "$lib/money/centavos";

export interface LoanPreviewItem {
  investor: Investor;
  sentDate: string;
  isPaid: boolean;
  capital: number;
  interest: number;
  interestRate: number;
  total: number;
}

export interface LoanFormSummary {
  totalCapital: number;
  totalInterest: number;
  totalAmount: number;
  totalReceived: number;
  totalBalance: number;
  averageRate: number;
  uniqueInvestors: number;
  status: LoanStatus;
  fundedCapital: number;
  balance: number;
}

export function getTotalPrincipal(
  selectedInvestors: SelectedInvestorAllocation[],
): number {
  return selectedInvestors.reduce(
    (sum, si) =>
      sum +
      si.transactions.reduce(
        (inner, t) => inner + (parseFloat(t.amount) || 0),
        0,
      ),
    0,
  );
}

export function calculateLoanPreview(
  selectedInvestors: SelectedInvestorAllocation[],
  options: { dueDate?: string; today?: string } = {},
): LoanPreviewItem[] {
  const rows = formPreviewRows(selectedInvestors, options);
  const result: LoanPreviewItem[] = [];

  for (const row of rows) {
    const si = selectedInvestors.find(
      (investor) => investor.investor.id === row.investorId,
    );
    const transaction = si?.transactions.find(
      (item) => item.id === row.transactionId,
    );
    if (!si || !transaction) continue;
    result.push({
      investor: si.investor,
      sentDate: transaction.sentDate,
      isPaid: transaction.isPaid,
      capital: row.capital,
      interest: row.interest,
      interestRate: row.interestRate,
      total: row.total,
    });
  }

  return result;
}

export function calculateLoanFormSummary(
  selectedInvestors: SelectedInvestorAllocation[],
  options: { dueDate?: string; today?: string } = {},
): LoanFormSummary {
  const ledger = buildFormLedger(selectedInvestors, options);
  const totalCapital = centavosToPesos(ledger.principalC);
  const totalInterest = centavosToPesos(ledger.interestExpectedC);
  const totalAmount = centavosToPesos(ledger.dueC);
  const totalReceived = centavosToPesos(ledger.receivedC);
  const totalBalance = centavosToPesos(ledger.balanceC);
  const averageRate =
    ledger.principalC > 0
      ? (ledger.interestExpectedC / ledger.principalC) * 100
      : 0;
  const fundedCapital = selectedInvestors.reduce(
    (sum, si) =>
      sum +
      si.transactions.reduce(
        (inner, transaction) =>
          transaction.isPaid
            ? inner + (Number(transaction.amount) || 0)
            : inner,
        0,
      ),
    0,
  );

  return {
    totalCapital,
    totalInterest,
    totalAmount,
    totalReceived,
    totalBalance,
    averageRate,
    uniqueInvestors: selectedInvestors.length,
    status: ledger.status,
    fundedCapital,
    balance: totalCapital - fundedCapital,
  };
}

export function buildContractDraft(input: {
  borrowerName: string;
  borrowerAddress?: string | null;
  borrowerContact?: string | null;
  borrowerEmail?: string | null;
  borrowerValidIdUrl?: string | null;
  borrowerESignatureUrl?: string | null;
  loanName: string;
  type: LoanContractDraftInput["type"];
  dueDate: string;
  freeLotSqm: string;
  notes: string;
  selectedInvestors: SelectedInvestorAllocation[];
  summary: LoanFormSummary;
  loanId?: number;
}): LoanContractDraftInput {
  return {
    borrowerName: input.borrowerName,
    borrowerAddress: input.borrowerAddress,
    borrowerContact: input.borrowerContact,
    borrowerEmail: input.borrowerEmail,
    borrowerValidIdUrl: input.borrowerValidIdUrl,
    borrowerESignatureUrl: input.borrowerESignatureUrl,
    loanTitleLabel: input.loanName,
    type: input.type,
    dueDate: input.dueDate,
    freeLotSqm: input.freeLotSqm,
    notes: input.notes,
    loanId: input.loanId,
    investors: input.selectedInvestors.map((si) => ({
      investor: si.investor,
      transactions: si.transactions.map((t) => ({
        amount: t.amount,
        interestRate: t.interestRate,
        interestAmount: t.interestAmount,
        interestType: t.interestType,
        sentDate: t.sentDate,
      })),
      hasMultipleInterest: si.hasMultipleInterest,
      interestPeriods: si.interestPeriods.map((period) => ({
        dueDate: period.dueDate,
        interestRate: period.interestRate,
        interestAmount: period.interestAmount,
        interestType: period.interestType,
      })),
    })),
    totalPrincipal: input.summary.totalCapital,
    totalInterest: input.summary.totalInterest,
    totalAmountDue: input.summary.totalAmount,
  };
}

export function buildInvestorsWithTransactionsForPreview(
  preview: LoanPreviewItem[],
  selectedInvestors: SelectedInvestorAllocation[],
): InvestorWithTransactions[] {
  const investorMap = new Map<number, LoanPreviewItem[]>();
  for (const item of preview) {
    const existing = investorMap.get(item.investor.id) ?? [];
    existing.push(item);
    investorMap.set(item.investor.id, existing);
  }

  return Array.from(investorMap.values()).map((transactions) => {
    const investorId = transactions[0].investor.id;
    const investorData = selectedInvestors.find(
      (si) => si.investor.id === investorId,
    );

    return {
      investor: transactions[0].investor,
      receivedPayments:
        investorData?.receivedPayments.map((rp) => ({
          amount: rp.amount,
          receivedDate: rp.receivedDate,
          interestPeriodId: null,
          id: /^\d+$/.test(rp.id) ? parseInt(rp.id, 10) : undefined,
          receipts: rp.receipts,
          notes: rp.notes,
        })) ?? [],
      transactions: transactions.map((t, index) => {
        const originalTransaction = investorData?.transactions.find(
          (ot) => ot.sentDate === t.sentDate,
        );

        return {
          id: `preview-${t.investor.id}-${index}`,
          amount: t.capital.toString(),
          interestRate:
            originalTransaction?.interestType === "fixed"
              ? originalTransaction.interestAmount
              : (originalTransaction?.interestRate ??
                t.interestRate.toString()),
          interestType: originalTransaction?.interestType || "rate",
          sentDate: t.sentDate,
          isPaid: t.isPaid,
          receipts: originalTransaction?.receipts ?? [],
          notes: originalTransaction?.notes,
        };
      }),
      hasMultipleInterest: investorData?.hasMultipleInterest || false,
      interestPeriods:
        investorData?.interestPeriods.map((period) => ({
          id: period.id,
          dueDate: period.dueDate,
          interestRate:
            period.interestType === "fixed"
              ? period.interestAmount
              : period.interestRate,
          interestType: period.interestType,
        })) ?? [],
    };
  });
}
