/**
 * Pure payload builders and validation for the loan form (T4.4).
 *
 * Keeping this out of the 2,000-line component makes the money paths testable
 * and stops the form from growing another copy of the rules.
 */
import type {
  LoanFormReceivedPayment,
  LoanFormTransaction,
  SelectedInvestorAllocation,
} from "$lib/components/loans/loan-form-types";
import {
  hasDuplicateInterestDueDates,
  hasPeriodValue,
} from "$lib/components/loans/multiple-interest-types";
import {
  hasPaymentReceipt,
  RECEIPT_REQUIRED_ERROR,
} from "$lib/payment-receipts";
import { formInvestorDue } from "$lib/loans/form-to-ledger";
import { todayKey } from "$lib/dates/business-date";

export interface InvestorPayloadRow {
  id?: number;
  investorId: number;
  amount: string;
  interestRate: string;
  interestType: "rate" | "fixed";
  sentDate: string;
  isPaid: boolean;
  hasMultipleInterest: boolean;
  receipts: LoanFormTransaction["receipts"];
  notes: string;
  interestPeriods?: Array<{
    id?: number;
    dueDate: string;
    interestRate: string;
    interestType: "rate" | "fixed";
  }>;
}

export interface ReceivedPaymentsPayload {
  investorId: number;
  receivedPayments: Array<{
    id: string;
    interestPeriodId: number | null;
    amount: string;
    receivedDate: string;
    receipts: LoanFormReceivedPayment["receipts"];
    notes: string;
  }>;
}

function numericId(value: string): number | undefined {
  return /^\d+$/.test(value) ? Number(value) : undefined;
}

export function buildInvestorPayload(
  selectedInvestors: SelectedInvestorAllocation[],
): InvestorPayloadRow[] {
  const rows: InvestorPayloadRow[] = [];

  for (const si of selectedInvestors) {
    // D-1: an agent (zero-capital) rate stays a rate. The ledger applies it to
    // the loan principal, so it never goes stale when the principal changes.
    const interestPeriods = si.hasMultipleInterest
      ? si.interestPeriods.map((period) => ({
          id: numericId(period.id),
          dueDate: period.dueDate,
          interestRate:
            period.interestType === "fixed"
              ? period.interestAmount
              : period.interestRate,
          interestType: period.interestType,
        }))
      : undefined;

    for (const transaction of si.transactions) {
      const interestType = transaction.interestType;
      rows.push({
        id: numericId(transaction.id),
        investorId: si.investor.id,
        amount: transaction.amount,
        interestRate:
          interestType === "fixed"
            ? transaction.interestAmount
            : transaction.interestRate,
        interestType,
        sentDate: transaction.sentDate,
        isPaid: transaction.isPaid,
        hasMultipleInterest: si.hasMultipleInterest,
        receipts: transaction.receipts,
        notes: transaction.notes,
        interestPeriods,
      });
    }
  }

  return rows;
}

export function buildReceivedPaymentsPayload(
  selectedInvestors: SelectedInvestorAllocation[],
): ReceivedPaymentsPayload[] {
  return selectedInvestors.map((si) => ({
    investorId: si.investor.id,
    receivedPayments: si.receivedPayments
      .filter((payment) => Number.parseFloat(payment.amount) > 0)
      .map((payment) => ({
        id: payment.id,
        interestPeriodId: payment.interestPeriodId ?? null,
        amount: payment.amount,
        receivedDate: payment.receivedDate,
        receipts: payment.receipts,
        notes: payment.notes,
      })),
  }));
}

export interface LoanFormValidationInput {
  loanName: string;
  dueDate: string;
  borrowerId: string;
  selectedInvestors: SelectedInvestorAllocation[];
}

/**
 * Field errors keyed for the form. Empty means the payload can be submitted.
 * Server validation remains the authority; this is the same rule set applied
 * earlier so the user sees the problem next to the field.
 */
export function validateLoanForm(
  input: LoanFormValidationInput,
): Record<string, string> {
  const next: Record<string, string> = {};
  if (!input.loanName.trim()) next.loanName = "Loan name is required";
  if (!input.dueDate) next.dueDate = "Due date is required";
  if (!input.borrowerId) next.borrowerId = "Borrower is required";
  if (input.selectedInvestors.length === 0) {
    next.investors = "At least one investor is required";
  }

  const today = todayKey();
  if (input.dueDate && input.dueDate < today) {
    // A new loan may be backdated, but the user must confirm it is not a
    // mistake. Keep this as a warning-level message until they change it.
    next.dueDate =
      next.dueDate ??
      "This due date is in the past. The loan will be overdue as soon as it is saved.";
  }

  let missingDisbursementReceipt = false;
  let missingReceivedReceipt = false;

  for (const si of input.selectedInvestors) {
    if (si.transactions.length === 0) {
      next.investors = `Add a principal disbursement for ${si.investor.name}.`;
      missingDisbursementReceipt = true;
    }
    for (const transaction of si.transactions) {
      const amountText = String(transaction.amount).trim();
      const interestRateText = String(transaction.interestRate).trim();
      const interestAmountText = String(transaction.interestAmount).trim();
      if (
        !amountText ||
        !Number.isFinite(Number(amountText)) ||
        Number(amountText) < 0
      ) {
        next.investors = "Each transaction needs a valid principal amount";
        break;
      }
      if (transaction.interestType === "rate" && !interestRateText) {
        next.investors =
          "Each transaction needs an interest rate or fixed amount";
        break;
      }
      if (transaction.interestType === "fixed" && !interestAmountText) {
        next.investors =
          "Each transaction needs an interest rate or fixed amount";
        break;
      }
      if (!hasPaymentReceipt(transaction)) {
        next[`receipt-tx-${transaction.id}`] = RECEIPT_REQUIRED_ERROR;
        missingDisbursementReceipt = true;
      }
    }

    for (const payment of si.receivedPayments) {
      const amount = Number.parseFloat(payment.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (!hasPaymentReceipt(payment)) {
        next[`receipt-rp-${payment.id}`] = RECEIPT_REQUIRED_ERROR;
        missingReceivedReceipt = true;
      }
    }

    if (si.hasMultipleInterest) {
      if (si.interestPeriods.length === 0) {
        next.investors = "Multiple interest periods are required";
        break;
      }
      if (hasDuplicateInterestDueDates(si.interestPeriods)) {
        next.investors = "Interest periods cannot share the same due date";
        break;
      }
      if (si.interestPeriods.some((period) => !hasPeriodValue(period))) {
        next.investors =
          "Enter an interest rate or fixed amount greater than zero for each period";
        break;
      }
    }

    const due = formInvestorDue(input.selectedInvestors, si.investor.id, {
      dueDate: input.dueDate || undefined,
      today,
    });
    const received = si.receivedPayments.reduce(
      (sum, payment) => sum + (Number.parseFloat(payment.amount) || 0),
      0,
    );
    if (due > 0 && received > due + 0.005) {
      next.investors =
        "Total received payments cannot exceed total amount due per investor";
    }
  }

  if (!next.investors && missingDisbursementReceipt && missingReceivedReceipt) {
    next.investors =
      "Upload a receipt for each disbursement and received payment.";
  } else if (!next.investors && missingDisbursementReceipt) {
    next.investors = "Upload a receipt for each principal disbursement.";
  } else if (!next.investors && missingReceivedReceipt) {
    next.investors = "Upload a receipt for each received payment.";
  }

  return next;
}
