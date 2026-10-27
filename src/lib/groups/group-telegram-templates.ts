/**
 * Group Telegram message templates.
 * Keys use {{snake_case}}. Optional lines use {{#if key}}...{{/if}}.
 * HTML allowed for Telegram parse_mode HTML: b, i, u, s, a, code, pre, br.
 */

export const GROUP_TELEGRAM_TEMPLATE_KINDS = [
  "upcoming",
  "due_today",
  "overdue",
  "digest",
  "unsigned",
  "upcoming_week",
  "activity_loan_created",
  "activity_loan_added",
  "activity_loan_updated",
  "activity_disbursement",
  "activity_payment",
  "activity_interest_extended",
  "activity_loan_completed",
  "activity_loan_removed",
  "activity_contract_signed",
  "activity",
  "test",
] as const;

export type GroupTelegramTemplateKind =
  (typeof GROUP_TELEGRAM_TEMPLATE_KINDS)[number];

export const GROUP_TELEGRAM_TEMPLATE_LABELS: Record<
  GroupTelegramTemplateKind,
  string
> = {
  upcoming: "Upcoming",
  due_today: "Due today",
  overdue: "Overdue",
  digest: "Daily digest",
  unsigned: "Unsigned",
  upcoming_week: "Next 7 days",
  activity_loan_created: "New loan",
  activity_loan_added: "Loan added",
  activity_loan_updated: "Loan updated",
  activity_disbursement: "Disbursement",
  activity_payment: "Payment",
  activity_interest_extended: "Interest extended",
  activity_loan_completed: "Completed",
  activity_loan_removed: "Loan removed",
  activity_contract_signed: "Contract signed",
  activity: "Other activity",
  test: "Test",
};

export const GROUP_TELEGRAM_TEMPLATE_CATEGORIES = [
  {
    id: "reminders",
    label: "Reminders",
    kinds: ["upcoming", "due_today", "overdue"],
  },
  {
    id: "digests",
    label: "Digests",
    kinds: ["digest", "unsigned", "upcoming_week"],
  },
  {
    id: "activity",
    label: "Activity",
    kinds: [
      "activity_loan_created",
      "activity_loan_added",
      "activity_loan_updated",
      "activity_disbursement",
      "activity_payment",
      "activity_interest_extended",
      "activity_loan_completed",
      "activity_loan_removed",
      "activity_contract_signed",
      "activity",
    ],
  },
  {
    id: "other",
    label: "Other",
    kinds: ["test"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  kinds: readonly GroupTelegramTemplateKind[];
}>;

export type GroupTelegramTemplateCategoryId =
  (typeof GROUP_TELEGRAM_TEMPLATE_CATEGORIES)[number]["id"];

const ACTIVITY_TEMPLATE_BY_TYPE: Record<string, GroupTelegramTemplateKind> = {
  loan_created: "activity_loan_created",
  loan_added: "activity_loan_added",
  loan_updated: "activity_loan_updated",
  disbursement: "activity_disbursement",
  payment_received: "activity_payment",
  interest_paid: "activity_payment",
  interest_extended: "activity_interest_extended",
  loan_completed: "activity_loan_completed",
  loan_removed: "activity_loan_removed",
  contract_signed: "activity_contract_signed",
};

export function templateKindForActivity(
  type: string,
): GroupTelegramTemplateKind {
  return ACTIVITY_TEMPLATE_BY_TYPE[type] ?? "activity";
}

const REMINDER_KINDS: GroupTelegramTemplateKind[] = [
  "upcoming",
  "due_today",
  "overdue",
];

const ACTIVITY_KINDS: GroupTelegramTemplateKind[] = [
  "activity_loan_created",
  "activity_loan_added",
  "activity_loan_updated",
  "activity_disbursement",
  "activity_payment",
  "activity_interest_extended",
  "activity_loan_completed",
  "activity_loan_removed",
  "activity_contract_signed",
  "activity",
];

const LOAN_KINDS: GroupTelegramTemplateKind[] = [
  ...REMINDER_KINDS,
  ...ACTIVITY_KINDS,
];

const DIGEST_KINDS: GroupTelegramTemplateKind[] = ["digest", "upcoming_week"];

const ALL_KINDS: GroupTelegramTemplateKind[] = [
  ...GROUP_TELEGRAM_TEMPLATE_KINDS,
];

export const TELEGRAM_PLACEHOLDER_GROUPS = [
  "Message",
  "Loan",
  "People",
  "Money",
  "Event",
  "Links",
] as const;

export type TelegramPlaceholderGroup =
  (typeof TELEGRAM_PLACEHOLDER_GROUPS)[number];

export const GROUP_TELEGRAM_PLACEHOLDERS: {
  key: string;
  label: string;
  group: TelegramPlaceholderGroup;
  kinds: GroupTelegramTemplateKind[];
}[] = [
  {
    key: "heading",
    label: "Reminder heading",
    group: "Message",
    kinds: REMINDER_KINDS,
  },
  {
    key: "action",
    label: "Action title",
    group: "Message",
    kinds: ACTIVITY_KINDS,
  },
  {
    key: "action_detail",
    label: "Action detail",
    group: "Message",
    kinds: ACTIVITY_KINDS,
  },
  {
    key: "summary",
    label: "One-line summary",
    group: "Message",
    kinds: ACTIVITY_KINDS,
  },
  {
    key: "empty_notice",
    label: "Empty-week line",
    group: "Message",
    kinds: DIGEST_KINDS,
  },
  {
    key: "pending_count",
    label: "Loans still unsigned",
    group: "Message",
    kinds: ["unsigned"],
  },
  {
    key: "today",
    label: "Today",
    group: "Message",
    kinds: DIGEST_KINDS,
  },
  {
    key: "loan_name",
    label: "Loan name",
    group: "Loan",
    kinds: LOAN_KINDS,
  },
  {
    key: "loan_type",
    label: "Loan type",
    group: "Loan",
    kinds: LOAN_KINDS,
  },
  {
    key: "status",
    label: "Loan status",
    group: "Loan",
    kinds: LOAN_KINDS,
  },
  {
    key: "due_date",
    label: "Loan due date",
    group: "Loan",
    kinds: LOAN_KINDS,
  },
  {
    key: "lot_size",
    label: "Lot size",
    group: "Loan",
    kinds: LOAN_KINDS,
  },
  {
    key: "notes",
    label: "Notes",
    group: "Loan",
    kinds: LOAN_KINDS,
  },
  {
    key: "days_until",
    label: "Days until due",
    group: "Loan",
    kinds: REMINDER_KINDS,
  },
  {
    key: "days_overdue",
    label: "Days overdue",
    group: "Loan",
    kinds: REMINDER_KINDS,
  },
  {
    key: "borrower",
    label: "Borrower",
    group: "People",
    kinds: LOAN_KINDS,
  },
  {
    key: "investors",
    label: "Investors",
    group: "People",
    kinds: LOAN_KINDS,
  },
  {
    key: "investor_count",
    label: "Investor count",
    group: "People",
    kinds: LOAN_KINDS,
  },
  {
    key: "witnesses",
    label: "Witnesses",
    group: "People",
    kinds: LOAN_KINDS,
  },
  {
    key: "signer_name",
    label: "Signer name",
    group: "People",
    kinds: ACTIVITY_KINDS,
  },
  {
    key: "signer_role",
    label: "Signer role",
    group: "People",
    kinds: ACTIVITY_KINDS,
  },
  {
    key: "signed_count",
    label: "Signed count",
    group: "People",
    kinds: ACTIVITY_KINDS,
  },
  {
    key: "signer_total",
    label: "Signer total",
    group: "People",
    kinds: ACTIVITY_KINDS,
  },
  {
    key: "amount",
    label: "Amount",
    group: "Money",
    kinds: [...REMINDER_KINDS, ...ACTIVITY_KINDS],
  },
  {
    key: "principal",
    label: "Principal",
    group: "Money",
    kinds: LOAN_KINDS,
  },
  {
    key: "principal_part",
    label: "Principal due this event",
    group: "Money",
    kinds: REMINDER_KINDS,
  },
  {
    key: "interest_part",
    label: "Interest due this event",
    group: "Money",
    kinds: REMINDER_KINDS,
  },
  {
    key: "rates",
    label: "Interest rates",
    group: "Money",
    kinds: LOAN_KINDS,
  },
  {
    key: "net",
    label: "7-day net",
    group: "Money",
    kinds: DIGEST_KINDS,
  },
  {
    key: "event_type",
    label: "Event type",
    group: "Event",
    kinds: REMINDER_KINDS,
  },
  {
    key: "event_date",
    label: "Event date",
    group: "Event",
    kinds: REMINDER_KINDS,
  },
  {
    key: "date",
    label: "Event date",
    group: "Event",
    kinds: REMINDER_KINDS,
  },
  {
    key: "due_today_count",
    label: "Due today count",
    group: "Event",
    kinds: DIGEST_KINDS,
  },
  {
    key: "due_today_body",
    label: "Due today lines",
    group: "Event",
    kinds: DIGEST_KINDS,
  },
  {
    key: "overdue_count",
    label: "Overdue count",
    group: "Event",
    kinds: DIGEST_KINDS,
  },
  {
    key: "overdue_body",
    label: "Overdue lines",
    group: "Event",
    kinds: DIGEST_KINDS,
  },
  {
    key: "upcoming_count",
    label: "Upcoming count",
    group: "Event",
    kinds: DIGEST_KINDS,
  },
  {
    key: "upcoming_body",
    label: "Upcoming lines",
    group: "Event",
    kinds: DIGEST_KINDS,
  },
  {
    key: "digest_body",
    label: "All digest sections",
    group: "Event",
    kinds: DIGEST_KINDS,
  },
  {
    key: "pending_body",
    label: "Unsigned loans",
    group: "Event",
    kinds: ["unsigned"],
  },
  {
    key: "group_name",
    label: "Group name",
    group: "Links",
    kinds: ALL_KINDS,
  },
  {
    key: "group_link",
    label: "Group link",
    group: "Links",
    kinds: ALL_KINDS,
  },
  {
    key: "loan_link",
    label: "Loan link",
    group: "Links",
    kinds: LOAN_KINDS,
  },
];

export const GROUP_TELEGRAM_PREVIEW_SAMPLES: Record<string, string> = {
  heading: "Upcoming in 3 days",
  action: "Payment received",
  action_detail: "₱12,000 from Juan Reyes on Oct 16, 2026",
  summary: "Payment received on Lot A",
  empty_notice: "",
  pending_count: "2",
  today: "Oct 16, 2026",
  loan_name: "Lot A",
  loan_type: "OR/CR",
  status: "Fully Funded",
  due_date: "Oct 16, 2026",
  lot_size: "120 sqm",
  notes: "Pickup at the office",
  days_until: "3 days",
  days_overdue: "4 days",
  borrower: "Maria Cruz",
  investors: "• Juan Reyes: ₱50,000\n• Ana Lim: ₱70,000",
  investor_count: "2",
  witnesses: "• Ana Lim",
  signer_name: "Maria Cruz",
  signer_role: "Borrower",
  signed_count: "2",
  signer_total: "3",
  amount: "₱12,000",
  principal: "₱120,000",
  principal_part: "₱100,000",
  interest_part: "₱12,000",
  rates: "• Juan Reyes: 5%",
  net: "+₱12,000",
  event_type: "Interest due",
  event_date: "Oct 16, 2026",
  date: "Oct 16, 2026",
  due_today_count: "1",
  due_today_body:
    "• Lot A · Interest due · Oct 16, 2026 · ₱12,000\n  Maria Cruz",
  overdue_count: "0",
  overdue_body: "",
  upcoming_count: "1",
  upcoming_body: "• Lot A · Due · Oct 20, 2026 · ₱120,000\n  Maria Cruz",
  digest_body: "Due today\n• Lot A · Interest due · ₱12,000",
  pending_body:
    "<b>Lot A</b>\nOR/CR · Due Oct 16, 2026 · ₱120,000\nWaiting:\n• Maria Cruz, Borrower",
  group_name: "Agent Romina",
  group_link: "Open group",
  loan_link: "View loan",
};

export function groupTelegramPlaceholdersFor(kind: GroupTelegramTemplateKind) {
  return GROUP_TELEGRAM_PLACEHOLDERS.filter((row) => row.kinds.includes(kind));
}

const LOAN_BLOCK = `<b>{{loan_name}}</b>
{{loan_type}} · {{status}}
Borrower: {{borrower}}
Investors:
{{investors}}
{{#if witnesses}}Witnesses: {{witnesses}}
{{/if}}Due: {{due_date}}
Principal: {{principal}}`;

const REMINDER_DEFAULT = `<b>{{heading}}</b>
<b>{{loan_name}}</b>
{{loan_type}} · {{status}}
Borrower: {{borrower}}
Investors:
{{investors}}
{{#if witnesses}}Witnesses: {{witnesses}}
{{/if}}{{event_type}}: {{event_date}}
Amount: {{amount}}
{{#if principal_part}}Principal due: {{principal_part}}
{{/if}}{{#if interest_part}}Interest due: {{interest_part}}
{{/if}}{{#if days_until}}Due in {{days_until}}
{{/if}}{{#if days_overdue}}Overdue by {{days_overdue}}
{{/if}}
{{loan_link}}`;

function activityDefault(title: string, extra = ""): string {
  const head = extra ? `<b>${title}</b>\n${extra}` : `<b>${title}</b>\n`;
  return `${head}${LOAN_BLOCK}\n\n{{loan_link}}`;
}

const ACTION_DETAIL_LINE = "{{#if action_detail}}{{action_detail}}\n{{/if}}";

export const DEFAULT_GROUP_TELEGRAM_TEMPLATES: Record<
  GroupTelegramTemplateKind,
  string
> = {
  upcoming: REMINDER_DEFAULT,
  due_today: REMINDER_DEFAULT,
  overdue: REMINDER_DEFAULT,
  digest: `<b>Daily digest · {{group_name}}</b>
{{today}}
{{#if due_today_body}}
<b>Due today ({{due_today_count}})</b>
{{due_today_body}}
{{/if}}{{#if overdue_body}}
<b>Overdue ({{overdue_count}})</b>
{{overdue_body}}
{{/if}}{{#if upcoming_body}}
<b>Next 7 days ({{upcoming_count}})</b>
{{upcoming_body}}
{{/if}}{{#if empty_notice}}{{empty_notice}}
{{/if}}
<b>Net (7 days)</b> {{net}}

{{group_link}}`,
  unsigned: `<b>Signatures still needed · {{group_name}}</b>
{{pending_count}} still open

{{pending_body}}

{{group_link}}`,
  upcoming_week: `<b>Next 7 days · {{group_name}}</b>
{{today}}
{{#if upcoming_body}}{{upcoming_body}}{{/if}}{{empty_notice}}

{{group_link}}`,
  activity_loan_created: activityDefault("New loan"),
  activity_loan_added: activityDefault("Added to {{group_name}}"),
  activity_loan_updated: activityDefault("Loan updated"),
  activity_disbursement: activityDefault("Disbursement", ACTION_DETAIL_LINE),
  activity_payment: activityDefault("Payment received", ACTION_DETAIL_LINE),
  activity_interest_extended: activityDefault(
    "Interest extended",
    ACTION_DETAIL_LINE,
  ),
  activity_loan_completed: activityDefault("Loan completed"),
  activity_loan_removed: activityDefault("Removed from {{group_name}}"),
  activity_contract_signed: activityDefault(
    "Contract signed",
    "{{signer_name}}, {{signer_role}}\n{{signed_count}} of {{signer_total}} signed\n",
  ),
  activity: activityDefault("Activity", "{{summary}}\n"),
  test: `<b>Test · {{group_name}}</b>
Telegram notifications are working.

{{group_link}}`,
};

/** Exact strings stored before this catalog. Treated as unset so groups pick up the new default. */
export const PREVIOUS_GROUP_TELEGRAM_TEMPLATES: Partial<
  Record<GroupTelegramTemplateKind, string>
> = {
  upcoming:
    "<b>{{heading}}</b>\n{{loan_name}} · {{event_type}} · {{date}} · {{amount}}\n\n{{loan_link}}",
  due_today:
    "<b>{{heading}}</b>\n{{loan_name}} · {{event_type}} · {{date}} · {{amount}}\n\n{{loan_link}}",
  overdue:
    "<b>{{heading}}</b>\n{{loan_name}} · {{event_type}} · {{date}} · {{amount}}\n\n{{loan_link}}",
  unsigned:
    "<b>Signatures still needed</b>\n{{pending_body}}\n\n{{group_link}}",
  digest: "<b>Daily digest · {{today}}</b>\n{{digest_body}}\n\n{{group_link}}",
  activity: "<b>Activity</b>\n{{summary}}\n\n{{loan_link}}",
  test: "<b>Test</b>\nTelegram notifications are working.\n\n{{group_link}}",
};

export const TELEGRAM_TEMPLATE_MAX_LENGTH = 4000;

const DISALLOWED_TAG =
  /<\/?(?!b\b|i\b|u\b|s\b|a\b|code\b|pre\b|br\b)[a-zA-Z][^>]*>/i;

export function telegramTemplateRejection(text: string): string | null {
  if (text.length > TELEGRAM_TEMPLATE_MAX_LENGTH) return "Template is too long";
  if (DISALLOWED_TAG.test(text)) return "Unsupported tag";
  return null;
}

function storedTemplate(
  kind: GroupTelegramTemplateKind,
  stored?: Record<string, string> | null,
): string | null {
  const custom = stored?.[kind]?.trim();
  if (!custom) return null;
  if (custom === PREVIOUS_GROUP_TELEGRAM_TEMPLATES[kind]) return null;
  return custom;
}

export function resolveGroupTelegramTemplate(
  kind: GroupTelegramTemplateKind,
  stored?: Record<string, string> | null,
): string {
  return storedTemplate(kind, stored) ?? DEFAULT_GROUP_TELEGRAM_TEMPLATES[kind];
}

const IF_BLOCK = /\{\{#if\s+([a-z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/gi;
const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

function lookupVar(
  vars: Record<string, string>,
  key: string,
): string | undefined {
  if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key];
  const lower = key.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(vars, lower)) return vars[lower];
  return undefined;
}

/** Replace `{{key}}` tokens. Unknown keys stay as-is. Empty `{{#if}}` blocks are removed. */
export function applyTelegramTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  const expanded = template.replace(
    IF_BLOCK,
    (_match, key: string, body: string) => {
      const value = lookupVar(vars, key);
      if (value === undefined || value.trim() === "") return "";
      return body;
    },
  );
  return expanded.replace(TOKEN, (match, key: string) => {
    const value = lookupVar(vars, key);
    return value !== undefined ? value : match;
  });
}

export function mergeGroupTelegramTemplates(
  stored?: Record<string, string> | null,
): Record<GroupTelegramTemplateKind, string> {
  const out = { ...DEFAULT_GROUP_TELEGRAM_TEMPLATES };
  if (!stored) return out;
  for (const kind of GROUP_TELEGRAM_TEMPLATE_KINDS) {
    const value = storedTemplate(kind, stored);
    if (value) out[kind] = value;
  }
  return out;
}
