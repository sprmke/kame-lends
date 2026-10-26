export type LoanFormFocusTarget = {
  domId: string;
  investorId?: number;
  tab?: "principal" | "received";
};

export type LoanFormFocusInvestor = {
  investorId: number;
  transactionIds: string[];
  receivedPaymentIds: string[];
};

/** First invalid control in visual order. Receipt rows win over the summary above the cards. */
export function firstLoanFormFocusTarget(
  errors: Record<string, string>,
  investors: LoanFormFocusInvestor[],
): LoanFormFocusTarget | null {
  if (errors.loanName) return { domId: "field-loan-name" };
  if (errors.dueDate) return { domId: "field-due-date" };
  if (errors.borrowerId) return { domId: "field-borrower" };

  for (const investor of investors) {
    for (const id of investor.transactionIds) {
      if (errors[`receipt-tx-${id}`]) {
        return {
          domId: `receipt-tx-${id}`,
          investorId: investor.investorId,
          tab: "principal",
        };
      }
    }
    for (const id of investor.receivedPaymentIds) {
      if (errors[`receipt-rp-${id}`]) {
        return {
          domId: `receipt-rp-${id}`,
          investorId: investor.investorId,
          tab: "received",
        };
      }
    }
  }

  if (errors.investors) return { domId: "investors-section" };
  return null;
}

/** Header / button message. Prefer the section summary over the short field line. */
export function loanFormValidationSummary(
  errors: Record<string, string>,
): string | null {
  if (errors.loanName) return errors.loanName;
  if (errors.dueDate) return errors.dueDate;
  if (errors.borrowerId) return errors.borrowerId;
  if (errors.investors) return errors.investors;
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith("receipt-")) return message;
  }
  return Object.values(errors)[0] ?? null;
}
