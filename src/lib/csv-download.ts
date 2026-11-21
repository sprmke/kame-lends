import { convertToCSV, downloadCSV } from "$lib/csv-export";
import {
  investorsCSVColumns,
  loansCSVColumns,
  transactionsCSVColumns,
} from "$lib/csv-columns";
import type {
  InvestorWithLoans,
  LoanWithInvestors,
  TransactionWithInvestor,
} from "$lib/types";

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadLoansCsv(data: LoanWithInvestors[]): void {
  if (data.length === 0) return;
  downloadCSV(convertToCSV(data, loansCSVColumns), `loans-${dateStamp()}.csv`);
}

export function downloadInvestorsCsv(data: InvestorWithLoans[]): void {
  if (data.length === 0) return;
  downloadCSV(
    convertToCSV(data, investorsCSVColumns),
    `investors-${dateStamp()}.csv`,
  );
}

export function downloadTransactionsCsv(data: TransactionWithInvestor[]): void {
  if (data.length === 0) return;
  downloadCSV(
    convertToCSV(data, transactionsCSVColumns),
    `transactions-${dateStamp()}.csv`,
  );
}
