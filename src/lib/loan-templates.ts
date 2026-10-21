import type { LoanType } from "$lib/types";

export const MAX_LOAN_TEMPLATES_PER_USER = 40;
export const MAX_TEMPLATE_NAME_LENGTH = 80;
export const MAX_TEMPLATE_LOAN_NAME_LENGTH = 120;
export const MAX_TEMPLATE_NOTES_LENGTH = 2000;
export const MAX_TEMPLATE_TERM_DAYS = 730;
export const MAX_TEMPLATE_GROUPS = 30;
export const MAX_TEMPLATE_PARTIES = 30;
export const DEFAULT_TEMPLATE_TERM_DAYS = 14;
export const LOAN_NAME_SENT_TOKEN = "{sent}";
export const LOAN_NAME_DUE_TOKEN = "{due}";

export type LoanTemplateNameMode = "static" | "date_range";
export type LoanTemplateInterestType = "rate" | "fixed";

export interface LoanTemplateInvestorInput {
  investorId: number;
  interestValue: string;
}

export interface LoanTemplateInvestor extends LoanTemplateInvestorInput {
  name: string | null;
}

export interface LoanTemplateBorrower {
  id: number;
  name: string;
}

export interface LoanTemplate {
  id: number;
  name: string;
  loanName: string;
  nameMode: LoanTemplateNameMode;
  type: LoanType;
  borrowerId: number | null;
  borrowerName: string | null;
  borrowerIds: number[];
  borrowers: LoanTemplateBorrower[];
  investors: LoanTemplateInvestor[];
  groupIds: number[];
  interestType: LoanTemplateInterestType;
  interestValue: string;
  termDays: number | null;
  notes: string | null;
  freeLotSqm: number | null;
}

export interface LoanTemplateInput {
  name: string;
  loanName: string;
  nameMode: LoanTemplateNameMode;
  type: LoanType;
  borrowerId: number | null;
  borrowerIds: number[];
  investors: LoanTemplateInvestorInput[];
  groupIds: number[];
  interestType: LoanTemplateInterestType;
  interestValue: string;
  termDays: number | null;
  notes: string | null;
  freeLotSqm: number | null;
}

const LOAN_TYPES: LoanType[] = ["Lot Title", "OR/CR", "Agent"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

type ParseResult =
  { ok: true; value: LoanTemplateInput } | { ok: false; error: string };

function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseIsoDate(
  value: string,
): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== m - 1 ||
    utc.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

export function addIsoDays(dateKey: string, days: number): string {
  const parsed = parseIsoDate(dateKey);
  if (!parsed || !Number.isInteger(days)) return dateKey;
  const next = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d + days));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatLoanDateRange(start: string, end: string): string | null {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  if (!a || !b) return null;
  if (a.y === b.y && a.m === b.m && a.d === b.d) {
    return `${MONTHS[a.m - 1]} ${a.d}`;
  }
  const startLabel = `${MONTHS[a.m - 1]} ${a.d}`;
  let endLabel = `${MONTHS[b.m - 1]} ${b.d}`;
  if (a.y === b.y && a.m === b.m) endLabel = String(b.d);
  else if (a.y !== b.y) endLabel = `${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
  return `${startLabel} - ${endLabel}`;
}

export function formatDatedLoanName(
  prefix: string,
  start: string,
  end: string,
): string {
  const base = prefix.trim();
  const range = formatLoanDateRange(start, end);
  if (!base) return range ? `(${range})` : "";
  if (!range) return base;
  return `${base} (${range})`;
}

export function defaultLoanNamePattern(type: LoanType): string {
  if (type === "Agent")
    return `Agent Loan (${LOAN_NAME_SENT_TOKEN} - ${LOAN_NAME_DUE_TOKEN})`;
  if (type === "OR/CR")
    return `OR/CR (${LOAN_NAME_SENT_TOKEN} - ${LOAN_NAME_DUE_TOKEN})`;
  return `Lot Title (${LOAN_NAME_SENT_TOKEN} - ${LOAN_NAME_DUE_TOKEN})`;
}

export function loanNameHasDateTokens(pattern: string): boolean {
  return (
    pattern.includes(LOAN_NAME_SENT_TOKEN) ||
    pattern.includes(LOAN_NAME_DUE_TOKEN)
  );
}

export function formatLoanDateLabel(dateKey: string): string | null {
  const parsed = parseIsoDate(dateKey);
  if (!parsed) return null;
  return `${MONTHS[parsed.m - 1]} ${parsed.d}`;
}

/** Older date-range presets stored a prefix. Show that prefix with date tokens. */
export function effectiveLoanNamePattern(
  loanName: string,
  nameMode: LoanTemplateNameMode,
): string {
  const base = loanName.trim();
  if (loanNameHasDateTokens(base)) return base;
  if (nameMode === "date_range") {
    return base
      ? `${base} (${LOAN_NAME_SENT_TOKEN} - ${LOAN_NAME_DUE_TOKEN})`
      : `${LOAN_NAME_SENT_TOKEN} - ${LOAN_NAME_DUE_TOKEN}`;
  }
  return base;
}

export function resolveLoanNamePattern(
  pattern: string,
  sent: string,
  due: string,
): string {
  const range = formatLoanDateRange(sent, due);
  const sentLabel = formatLoanDateLabel(sent);
  const dueLabel = formatLoanDateLabel(due);
  let next = pattern;
  if (range) {
    next = next.replace(
      new RegExp(
        `${escapeRegExp(LOAN_NAME_SENT_TOKEN)}\\s*-\\s*${escapeRegExp(LOAN_NAME_DUE_TOKEN)}`,
        "g",
      ),
      range,
    );
  }
  if (sentLabel) next = next.replaceAll(LOAN_NAME_SENT_TOKEN, sentLabel);
  if (dueLabel) next = next.replaceAll(LOAN_NAME_DUE_TOKEN, dueLabel);
  return next.trim();
}

export function loanNameFromTemplate(
  loanName: string,
  nameMode: LoanTemplateNameMode,
  sent: string,
  due: string,
): string {
  const pattern = effectiveLoanNamePattern(loanName, nameMode);
  if (!loanNameHasDateTokens(pattern)) return pattern;
  return resolveLoanNamePattern(pattern, sent, due) || pattern;
}

export function templateLoanNameIsDynamic(
  loanName: string,
  nameMode: LoanTemplateNameMode,
): boolean {
  return loanNameHasDateTokens(effectiveLoanNamePattern(loanName, nameMode));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatInterestInput(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

export function normalizeGroupIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((item) => Number(item))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

export function normalizeTemplateInvestors(
  value: unknown,
): LoanTemplateInvestorInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const investors: LoanTemplateInvestorInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const investorId = Number(record.investorId);
    if (
      !Number.isInteger(investorId) ||
      investorId <= 0 ||
      seen.has(investorId)
    ) {
      continue;
    }
    seen.add(investorId);
    investors.push({
      investorId,
      interestValue: trimmedString(record.interestValue),
    });
  }
  return investors;
}

export function parseLoanTemplateInput(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid template" };
  }
  const body = raw as Record<string, unknown>;

  const name = trimmedString(body.name);
  if (!name) return { ok: false, error: "Template name is required" };
  if (name.length > MAX_TEMPLATE_NAME_LENGTH) {
    return { ok: false, error: "Template name is too long" };
  }

  const loanName = trimmedString(body.loanName);
  if (!loanName) return { ok: false, error: "Loan name is required" };
  if (loanName.length > MAX_TEMPLATE_LOAN_NAME_LENGTH) {
    return { ok: false, error: "Loan name is too long" };
  }

  if (
    body.nameMode != null &&
    body.nameMode !== "static" &&
    body.nameMode !== "date_range"
  ) {
    return { ok: false, error: "Invalid name mode" };
  }
  const nameMode: LoanTemplateNameMode =
    loanNameHasDateTokens(loanName) || body.nameMode === "date_range"
      ? "date_range"
      : "static";

  const type = body.type;
  if (type !== "Lot Title" && type !== "OR/CR" && type !== "Agent") {
    return { ok: false, error: "Type is required" };
  }
  if (!LOAN_TYPES.includes(type)) {
    return { ok: false, error: "Type is required" };
  }

  let borrowerIds = normalizeGroupIds(body.borrowerIds);
  if (
    body.borrowerId != null &&
    body.borrowerId !== "" &&
    borrowerIds.length === 0
  ) {
    const parsed = Number(body.borrowerId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: "Borrower not found" };
    }
    borrowerIds = [parsed];
  }
  if (borrowerIds.length > MAX_TEMPLATE_PARTIES) {
    return { ok: false, error: "Too many borrowers" };
  }
  const borrowerId = borrowerIds[0] ?? null;

  const investorDrafts = normalizeTemplateInvestors(body.investors);
  if (investorDrafts.length > MAX_TEMPLATE_PARTIES) {
    return { ok: false, error: "Too many investors" };
  }

  const groupIds = normalizeGroupIds(body.groupIds);
  if (
    Array.isArray(body.groupIds) &&
    groupIds.length !==
      new Set(
        body.groupIds.filter((id) => id != null && String(id).trim() !== ""),
      ).size
  ) {
    return { ok: false, error: "Group not found" };
  }
  if (groupIds.length > MAX_TEMPLATE_GROUPS) {
    return { ok: false, error: "Too many groups" };
  }

  const interestType = body.interestType === "fixed" ? "fixed" : "rate";
  if (
    body.interestType != null &&
    body.interestType !== "rate" &&
    body.interestType !== "fixed"
  ) {
    return { ok: false, error: "Invalid interest type" };
  }

  const interestRaw = trimmedString(
    body.interestValue ?? body.interestRate ?? "",
  );
  const interestNumber = Number(interestRaw);
  if (!interestRaw || !Number.isFinite(interestNumber) || interestNumber < 0) {
    return {
      ok: false,
      error: interestType === "fixed" ? "Enter an amount" : "Enter a rate",
    };
  }
  if (interestNumber > 999_999_999.99) {
    return { ok: false, error: "Amount is too large" };
  }
  const interestValue = interestNumber.toFixed(2);
  const investors: LoanTemplateInvestorInput[] = [];
  for (const investor of investorDrafts) {
    const raw = investor.interestValue || interestRaw;
    const amount = Number(raw);
    if (
      !raw ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 999_999_999.99
    ) {
      return {
        ok: false,
        error: interestType === "fixed" ? "Enter an amount" : "Enter a rate",
      };
    }
    investors.push({
      investorId: investor.investorId,
      interestValue: amount.toFixed(2),
    });
  }

  let termDays: number | null = null;
  if (body.termDays != null && body.termDays !== "") {
    const parsed = Number(body.termDays);
    if (
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > MAX_TEMPLATE_TERM_DAYS
    ) {
      return {
        ok: false,
        error: `Term must be between 1 and ${MAX_TEMPLATE_TERM_DAYS} days`,
      };
    }
    termDays = parsed;
  }

  const notesText = trimmedString(body.notes);
  if (notesText.length > MAX_TEMPLATE_NOTES_LENGTH) {
    return { ok: false, error: "Notes are too long" };
  }
  const notes = notesText || null;

  let freeLotSqm: number | null = null;
  if (
    type === "Lot Title" &&
    body.freeLotSqm != null &&
    body.freeLotSqm !== ""
  ) {
    const parsed = Number(body.freeLotSqm);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) {
      return { ok: false, error: "Free lot must be a whole number" };
    }
    freeLotSqm = parsed;
  }

  return {
    ok: true,
    value: {
      name,
      loanName,
      nameMode,
      type,
      borrowerId,
      borrowerIds,
      investors,
      groupIds,
      interestType,
      interestValue,
      termDays,
      notes,
      freeLotSqm,
    },
  };
}
