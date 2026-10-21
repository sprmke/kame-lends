import type { ProposalWarning } from "./group-transactions";

export type WarningTone = "danger" | "warning";

/** Short, plain labels for review badges. */
export function warningLabel(warning: ProposalWarning): string {
  switch (warning.code) {
    case "invalid_receipt":
      return "Not a receipt";
    case "unclear_receipt":
      return "Hard to read";
    case "low_confidence":
      return "Double-check";
    case "missing_amount":
      return "No amount found";
    case "missing_date":
      return "No date found";
    case "future_date":
      return "Date is in the future";
    case "old_date":
      return "Older than 6 months";
    case "failed_transfer":
      return "Failed transfer";
    case "pending_transfer":
      return "Still pending";
    case "non_php_currency":
      return "Not in pesos";
    case "already_recorded":
      return warning.detail
        ? `Already recorded in ${warning.detail}`
        : "Already recorded";
    case "scan_failed":
      return "Couldn't read";
    case "over_remaining":
      return "More than the remaining balance";
    case "lender_not_matched":
      return warning.detail
        ? `Pick the lender for ${warning.detail}`
        : "Pick the lender";
  }
}

export function warningTone(warning: ProposalWarning): WarningTone {
  return warning.code === "already_recorded" ||
    warning.code === "failed_transfer"
    ? "danger"
    : "warning";
}
