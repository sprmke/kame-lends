import type { InterestPeriodStatus, InterestType, Investor } from "$lib/types";
import type { InterestPeriodData } from "./multiple-interest-types";
import type { PaymentReceipt } from "$lib/payment-receipts";

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
}

export interface LoanFormReceivedPayment {
  id: string;
  amount: string;
  receivedDate: string;
  receipts: PaymentReceipt[];
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
