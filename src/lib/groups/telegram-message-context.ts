import { formatCalendarCurrency } from "$lib/calendar-events";
import { toLocalDateString } from "$lib/date-utils";
import type { LoanWithInvestors } from "$lib/types";

export const TELEGRAM_LIST_CAP = 12;

export type TelegramActivityDetail = {
  amount?: number;
  date?: string;
  investorName?: string;
  signerName?: string;
  signerRole?: string;
  signedCount?: number;
  signerTotal?: number;
  loanName?: string;
  loanType?: string;
  status?: string;
  borrowerName?: string;
  principal?: number;
};

export type TelegramEventContext = {
  heading: string;
  typeLabel: string;
  dateKey: string;
  totalAmount: number;
  principalPart?: number | null;
  interestPart?: number | null;
  daysUntil?: number | null;
  daysOverdue?: number | null;
};

export function escapeTelegramHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatTelegramDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTelegramMoney(
  amount: number,
  includeAmounts: boolean,
): string {
  if (!includeAmounts) return "Hidden";
  return formatCalendarCurrency(amount);
}

export function telegramLinkHtml(url: string, label: string): string {
  return `<a href="${escapeTelegramHtml(url)}">${escapeTelegramHtml(label)}</a>`;
}

export function capTelegramLines(
  lines: string[],
  max = TELEGRAM_LIST_CAP,
): string {
  if (lines.length === 0) return "";
  if (lines.length <= max) return lines.join("\n");
  return `${lines.slice(0, max).join("\n")}\nAnd ${lines.length - max} more.`;
}

export function formatDayCount(days: number): string {
  const n = Math.abs(Math.round(days));
  return n === 1 ? "1 day" : `${n} days`;
}

export function telegramSigningRoleLabel(partyRole: string): string {
  if (partyRole === "borrower") return "Borrower";
  if (partyRole === "lender") return "Investor";
  if (partyRole === "witness_1" || partyRole === "witness_2") return "Witness";
  return partyRole;
}

function appPath(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/$/, "")}${path}`;
}

function moneyOrEmpty(
  amount: number | null | undefined,
  includeAmounts: boolean,
): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  return formatTelegramMoney(amount, includeAmounts);
}

function actionDetailText(
  activityType: string | undefined,
  detail: TelegramActivityDetail | undefined,
  includeAmounts: boolean,
): string {
  if (!detail || !activityType) return "";
  if (
    activityType === "disbursement" ||
    activityType === "payment_received" ||
    activityType === "interest_paid"
  ) {
    const money =
      detail.amount != null && includeAmounts
        ? formatCalendarCurrency(detail.amount)
        : "";
    const name = detail.investorName?.trim() ?? "";
    const date = detail.date ? formatTelegramDateKey(detail.date) : "";
    const parts: string[] = [];
    if (money) parts.push(money);
    if (name) parts.push(money ? `from ${name}` : name);
    if (date) parts.push(parts.length > 0 ? `on ${date}` : date);
    return parts.join(" ");
  }
  if (activityType === "interest_extended" && detail.date) {
    return `Next due ${formatTelegramDateKey(detail.date)}`;
  }
  if (activityType === "contract_signed") {
    const who = [detail.signerName?.trim(), detail.signerRole?.trim()]
      .filter(Boolean)
      .join(", ");
    const count =
      detail.signedCount != null && detail.signerTotal != null
        ? `${detail.signedCount} of ${detail.signerTotal} signed.`
        : "";
    if (who && count) return `${who}. ${count}`;
    return who || count;
  }
  return "";
}

const ACTION_TITLES: Record<string, string> = {
  loan_created: "New loan",
  loan_added: "Loan added",
  loan_updated: "Loan updated",
  disbursement: "Disbursement",
  payment_received: "Payment received",
  interest_paid: "Payment received",
  interest_extended: "Interest extended",
  loan_completed: "Loan completed",
  loan_removed: "Loan removed",
  contract_signed: "Contract signed",
};

export function buildTelegramLoanContext(
  loan: LoanWithInvestors | null,
  options: {
    appUrl: string;
    groupId: number;
    groupName: string;
    includeAmounts: boolean;
    event?: TelegramEventContext;
    detail?: TelegramActivityDetail;
    summary?: string;
    activityType?: string;
    loanId?: number | null;
  },
): Record<string, string> {
  const include = options.includeAmounts;
  const detail = options.detail;
  const investors = loan?.loanInvestors ?? [];
  const investorLines = investors.map((row) => {
    const name = escapeTelegramHtml(row.investor?.name?.trim() || "Investor");
    if (!include) return `• ${name}`;
    const amount = Number.parseFloat(row.amount);
    const money = Number.isFinite(amount) ? formatCalendarCurrency(amount) : "";
    return money ? `• ${name}: ${money}` : `• ${name}`;
  });
  const rateLines = investors.map((row) => {
    const name = escapeTelegramHtml(row.investor?.name?.trim() || "Investor");
    if (row.interestType === "fixed") {
      const amount = Number.parseFloat(row.interestRate);
      const money = include
        ? formatCalendarCurrency(Number.isFinite(amount) ? amount : 0)
        : "Hidden";
      return `• ${name}: ${money}`;
    }
    const rate = Number.parseFloat(row.interestRate);
    const label = Number.isFinite(rate)
      ? `${rate}%`
      : escapeTelegramHtml(row.interestRate);
    return `• ${name}: ${label}`;
  });
  const witnessLines = (loan?.loanWitnesses ?? [])
    .map((row) => row.witness?.name?.trim())
    .filter((name): name is string => Boolean(name))
    .map((name) => `• ${escapeTelegramHtml(name)}`);

  const principalFromLoan = investors.reduce((sum, row) => {
    const amount = Number.parseFloat(row.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const principalAmount = loan ? principalFromLoan : detail?.principal;
  const borrowerName = loan
    ? loan.borrower?.name?.trim() || "No borrower"
    : detail?.borrowerName?.trim() || "No borrower";
  const notes = loan?.notes?.trim() ?? "";
  const lotSize =
    loan?.type === "Lot Title" && loan.freeLotSqm != null
      ? `${loan.freeLotSqm} sqm`
      : "";
  const event = options.event;
  const eventDate = event ? formatTelegramDateKey(event.dateKey) : "";
  const eventAmount = event
    ? formatTelegramMoney(event.totalAmount, include)
    : moneyOrEmpty(detail?.amount, include);

  return {
    group_name: escapeTelegramHtml(options.groupName),
    group_link: telegramLinkHtml(
      appPath(options.appUrl, `/groups/${options.groupId}`),
      "Open group",
    ),
    loan_name: escapeTelegramHtml(
      loan?.loanName?.trim() || detail?.loanName?.trim() || "Loan",
    ),
    loan_type: escapeTelegramHtml(loan?.type || detail?.loanType || ""),
    status: escapeTelegramHtml(loan?.status || detail?.status || ""),
    borrower: escapeTelegramHtml(borrowerName),
    investors:
      investorLines.length > 0
        ? capTelegramLines(investorLines)
        : loan
          ? "None"
          : "",
    investor_count: loan ? String(investors.length) : "",
    witnesses: capTelegramLines(witnessLines),
    due_date: loan?.dueDate
      ? formatTelegramDateKey(toLocalDateString(loan.dueDate))
      : "",
    principal: moneyOrEmpty(principalAmount, include),
    rates: capTelegramLines(rateLines),
    lot_size: lotSize,
    notes: escapeTelegramHtml(notes.slice(0, 240)),
    loan_link:
      (loan?.id ?? options.loanId) != null
        ? telegramLinkHtml(
            appPath(options.appUrl, `/loans/${loan?.id ?? options.loanId}`),
            "View loan",
          )
        : "",
    heading: escapeTelegramHtml(event?.heading ?? ""),
    event_type: escapeTelegramHtml(event?.typeLabel ?? ""),
    event_date: eventDate,
    date: eventDate,
    amount: eventAmount,
    principal_part: moneyOrEmpty(event?.principalPart, include),
    interest_part: moneyOrEmpty(event?.interestPart, include),
    days_until:
      event?.daysUntil != null && event.daysUntil > 0
        ? formatDayCount(event.daysUntil)
        : "",
    days_overdue:
      event?.daysOverdue != null && event.daysOverdue > 0
        ? formatDayCount(event.daysOverdue)
        : "",
    action: escapeTelegramHtml(
      options.activityType ? (ACTION_TITLES[options.activityType] ?? "") : "",
    ),
    action_detail: escapeTelegramHtml(
      actionDetailText(options.activityType, detail, include),
    ),
    summary: escapeTelegramHtml(options.summary?.trim() ?? ""),
    signer_name: escapeTelegramHtml(detail?.signerName?.trim() ?? ""),
    signer_role: escapeTelegramHtml(detail?.signerRole?.trim() ?? ""),
    signed_count: detail?.signedCount != null ? String(detail.signedCount) : "",
    signer_total: detail?.signerTotal != null ? String(detail.signerTotal) : "",
  };
}
