/**
 * Group Telegram message templates (kame-homes-style placeholders).
 * Keys use {{snake_case}}. HTML allowed for Telegram parse_mode HTML.
 */

export const GROUP_TELEGRAM_TEMPLATE_KINDS = [
  "upcoming",
  "due_today",
  "overdue",
  "digest",
  "activity",
  "test",
] as const;

export type GroupTelegramTemplateKind =
  (typeof GROUP_TELEGRAM_TEMPLATE_KINDS)[number];

export const GROUP_TELEGRAM_TEMPLATE_LABELS: Record<
  GroupTelegramTemplateKind,
  string
> = {
  upcoming: "Upcoming reminder",
  due_today: "Due today",
  overdue: "Overdue",
  digest: "Daily digest",
  activity: "Activity",
  test: "Test message",
};

/** Placeholders operators can insert. Not every key applies to every template. */
export const GROUP_TELEGRAM_PLACEHOLDERS: {
  key: string;
  label: string;
  kinds: GroupTelegramTemplateKind[];
}[] = [
  {
    key: "heading",
    label: "Reminder heading",
    kinds: ["upcoming", "due_today", "overdue"],
  },
  {
    key: "loan_name",
    label: "Loan name",
    kinds: ["upcoming", "due_today", "overdue"],
  },
  {
    key: "event_type",
    label: "Event type",
    kinds: ["upcoming", "due_today", "overdue"],
  },
  {
    key: "date",
    label: "Event date",
    kinds: ["upcoming", "due_today", "overdue"],
  },
  {
    key: "amount",
    label: "Amount",
    kinds: ["upcoming", "due_today", "overdue"],
  },
  {
    key: "loan_link",
    label: "Loan URL",
    kinds: ["upcoming", "due_today", "overdue", "activity"],
  },
  {
    key: "group_link",
    label: "Group URL",
    kinds: ["digest", "activity", "test"],
  },
  {
    key: "digest_body",
    label: "Digest sections",
    kinds: ["digest"],
  },
  {
    key: "today",
    label: "Today (formatted)",
    kinds: ["digest"],
  },
  {
    key: "summary",
    label: "Activity summary",
    kinds: ["activity"],
  },
];

export const DEFAULT_GROUP_TELEGRAM_TEMPLATES: Record<
  GroupTelegramTemplateKind,
  string
> = {
  upcoming:
    "<b>{{heading}}</b>\n{{loan_name}} · {{event_type}} · {{date}} · {{amount}}\n\n{{loan_link}}",
  due_today:
    "<b>{{heading}}</b>\n{{loan_name}} · {{event_type}} · {{date}} · {{amount}}\n\n{{loan_link}}",
  overdue:
    "<b>{{heading}}</b>\n{{loan_name}} · {{event_type}} · {{date}} · {{amount}}\n\n{{loan_link}}",
  digest: "<b>Daily digest · {{today}}</b>\n{{digest_body}}\n\n{{group_link}}",
  activity: "<b>Activity</b>\n{{summary}}\n\n{{loan_link}}",
  test: "<b>Test</b>\nTelegram notifications are working.\n\n{{group_link}}",
};

export function resolveGroupTelegramTemplate(
  kind: GroupTelegramTemplateKind,
  stored?: Record<string, string> | null,
): string {
  const custom = stored?.[kind]?.trim();
  if (custom) return custom;
  return DEFAULT_GROUP_TELEGRAM_TEMPLATES[kind];
}

/** Replace `{{key}}` tokens. Unknown keys stay as-is. */
export function applyTelegramTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(
    /\{\{\s*([a-z0-9_]+)\s*\}\}/gi,
    (match, key: string) => {
      const value = vars[key];
      return value !== undefined ? value : match;
    },
  );
}

export function mergeGroupTelegramTemplates(
  stored?: Record<string, string> | null,
): Record<GroupTelegramTemplateKind, string> {
  const out = { ...DEFAULT_GROUP_TELEGRAM_TEMPLATES };
  if (!stored) return out;
  for (const kind of GROUP_TELEGRAM_TEMPLATE_KINDS) {
    const value = stored[kind]?.trim();
    if (value) out[kind] = value;
  }
  return out;
}
