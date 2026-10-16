import { toLocalDateString } from "$lib/date-utils";
import type { SelectedInvestorAllocation } from "$lib/components/loans/loan-form-types";
import type { DuplicateLoanData } from "$lib/loan-duplicate";
import type { Investor, LoanWithInvestors } from "$lib/types";
import { normalizePaymentReceipts } from "$lib/payment-receipts";

function interestPeriodFormId(
  period: { id?: number | null },
  loanInvestorId: number,
  index: number,
): string {
  if (period.id != null) return String(period.id);
  return `period-li-${loanInvestorId}-${index}`;
}

function transactionFormId(
  loanInvestorId: number | undefined,
  index: number,
): string {
  if (loanInvestorId != null) return String(loanInvestorId);
  return `tx-${index}`;
}

function mergeReceivedPaymentsForInvestor(
  loanInvestors: LoanWithInvestors["loanInvestors"],
  investorId: number,
): SelectedInvestorAllocation["receivedPayments"] {
  const seenDbIds = new Set<number>();
  const merged: SelectedInvestorAllocation["receivedPayments"] = [];

  for (const li of loanInvestors.filter(
    (row) => row.investor.id === investorId,
  )) {
    for (const rp of li.receivedPayments ?? []) {
      if (rp.id != null) {
        if (seenDbIds.has(rp.id)) continue;
        seenDbIds.add(rp.id);
        merged.push({
          id: String(rp.id),
          amount: rp.amount,
          receivedDate: toLocalDateString(rp.receivedDate),
          receipts: normalizePaymentReceipts(rp),
        });
        continue;
      }
      merged.push({
        id: `rp-li-${li.id}-${merged.length}`,
        amount: rp.amount,
        receivedDate: toLocalDateString(rp.receivedDate),
        receipts: normalizePaymentReceipts(rp),
      });
    }
  }

  return merged;
}

export function buildAllocationsFromExistingLoan(
  loan: LoanWithInvestors,
): SelectedInvestorAllocation[] {
  const investorMap = new Map<
    number,
    SelectedInvestorAllocation["transactions"]
  >();

  for (const li of loan.loanInvestors) {
    const transactions = investorMap.get(li.investor.id) ?? [];
    const interestAmount = li.interestType === "fixed" ? li.interestRate : "";
    const interestRate = li.interestType === "rate" ? li.interestRate : "";

    transactions.push({
      id: transactionFormId(li.id, transactions.length),
      amount: li.amount,
      interestRate,
      interestAmount,
      interestType: li.interestType,
      sentDate: toLocalDateString(li.sentDate),
      isPaid: li.isPaid,
      dateTouched: true,
      receipts: normalizePaymentReceipts(li),
    });
    investorMap.set(li.investor.id, transactions);
  }

  const result: SelectedInvestorAllocation[] = [];

  for (const [investorId, transactions] of investorMap) {
    const firstLoanInvestor = loan.loanInvestors.find(
      (li) => li.investor.id === investorId,
    );
    const investor = firstLoanInvestor?.investor;
    if (!investor) continue;

    const loanInvestorId = firstLoanInvestor?.id ?? investorId;
    const interestPeriods =
      firstLoanInvestor?.interestPeriods?.map((ip, index) => ({
        id: interestPeriodFormId(ip, loanInvestorId, index),
        dueDate: toLocalDateString(ip.dueDate),
        interestRate: ip.interestType === "rate" ? ip.interestRate : "",
        interestAmount: ip.interestType === "fixed" ? ip.interestRate : "",
        interestType: ip.interestType,
        status: ip.status,
      })) ?? [];

    const receivedPayments = mergeReceivedPaymentsForInvestor(
      loan.loanInvestors,
      investorId,
    );

    result.push({
      investor,
      transactions,
      receivedPayments,
      hasMultipleInterest: firstLoanInvestor?.hasMultipleInterest ?? false,
      interestPeriods,
    });
  }

  return result;
}

export function buildAllocationsFromDuplicateData(
  data: DuplicateLoanData,
  investors: Investor[],
): SelectedInvestorAllocation[] {
  const byInvestor = new Map<number, SelectedInvestorAllocation>();

  for (const row of data.loanInvestors) {
    const investor = investors.find((inv) => inv.id === row.investorId);
    if (!investor) continue;

    let allocation = byInvestor.get(row.investorId);
    if (!allocation) {
      allocation = {
        investor,
        transactions: [],
        receivedPayments: [],
        hasMultipleInterest: row.hasMultipleInterest,
        interestPeriods:
          row.interestPeriods?.map((period, index) => ({
            id: `period-${index}`,
            dueDate: toLocalDateString(period.dueDate),
            interestRate:
              period.interestType === "rate" ? period.interestRate : "",
            interestAmount:
              period.interestType === "fixed" ? period.interestRate : "",
            interestType: period.interestType,
            status: period.status,
          })) ?? [],
      };
      byInvestor.set(row.investorId, allocation);
    }

    allocation.transactions.push({
      id: `temp-${row.investorId}-${allocation.transactions.length}`,
      amount: row.amount,
      sentDate: toLocalDateString(row.sentDate),
      interestType: row.interestType,
      interestRate: row.interestType === "rate" ? row.interestRate : "",
      interestAmount: row.interestType === "fixed" ? row.interestRate : "",
      isPaid: row.isPaid,
      dateTouched: true,
      receipts: [],
    });
  }

  return Array.from(byInvestor.values());
}
