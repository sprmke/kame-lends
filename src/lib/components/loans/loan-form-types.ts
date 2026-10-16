import type { InterestPeriodStatus, InterestType, Investor } from "$lib/types";
import type { InterestPeriodData } from "./multiple-interest-types";
import type { PaymentReceipt } from "$lib/payment-receipts";
import type { RowScanMeta } from "$lib/receipt-scan/rows";

export interface LoanFormTransaction {
  id: string;
  amount: string;
  sentDate: string;
  interestType: InterestType;
  interestRate: string;
  interestAmount: string;
  isPaid: boolean;
  dateTouched: boolean;
  receipts: PaymentReceipt[];
  /** AI notes when the row was created from receipts (UI only, never sent). */
  scan?: RowScanMeta | null;
}

export interface LoanFormReceivedPayment {
  id: string;
  amount: string;
  receivedDate: string;
  receipts: PaymentReceipt[];
  /** AI notes when the row was created from receipts (UI only, never sent). */
  scan?: RowScanMeta | null;
}

export interface SelectedInvestorAllocation {
  investor: Investor;
  transactions: LoanFormTransaction[];
  receivedPayments: LoanFormReceivedPayment[];
  hasMultipleInterest: boolean;
  interestPeriods: InterestPeriodData[];
}

export interface DuplicateInterestPeriod {
  dueDate: string | Date;
  interestRate: string;
  interestType: InterestType;
  status: InterestPeriodStatus;
}
