export const GROUP_COLOR_KEYS = [
  "orange",
  "amber",
  "emerald",
  "teal",
  "sky",
  "indigo",
  "violet",
  "rose",
] as const;

export type GroupColorKey = (typeof GROUP_COLOR_KEYS)[number];

export type GroupColorClasses = {
  key: GroupColorKey;
  /** Solid dot / edge */
  dot: string;
  /** Soft background tint */
  bg: string;
  /** Readable text on tint */
  text: string;
  /** Focus / selected ring */
  ring: string;
};

const PALETTE: Record<GroupColorKey, Omit<GroupColorClasses, "key">> = {
  orange: {
    dot: "bg-orange-500 dark:bg-orange-400",
    bg: "bg-orange-500/10 dark:bg-orange-400/15",
    text: "text-orange-800 dark:text-orange-200",
    ring: "ring-orange-500/40 dark:ring-orange-400/40",
  },
  amber: {
    dot: "bg-amber-500 dark:bg-amber-400",
    bg: "bg-amber-500/10 dark:bg-amber-400/15",
    text: "text-amber-900 dark:text-amber-200",
    ring: "ring-amber-500/40 dark:ring-amber-400/40",
  },
  emerald: {
    dot: "bg-emerald-500 dark:bg-emerald-400",
    bg: "bg-emerald-500/10 dark:bg-emerald-400/15",
    text: "text-emerald-900 dark:text-emerald-200",
    ring: "ring-emerald-500/40 dark:ring-emerald-400/40",
  },
  teal: {
    dot: "bg-teal-500 dark:bg-teal-400",
    bg: "bg-teal-500/10 dark:bg-teal-400/15",
    text: "text-teal-900 dark:text-teal-200",
    ring: "ring-teal-500/40 dark:ring-teal-400/40",
  },
  sky: {
    dot: "bg-sky-500 dark:bg-sky-400",
    bg: "bg-sky-500/10 dark:bg-sky-400/15",
    text: "text-sky-900 dark:text-sky-200",
    ring: "ring-sky-500/40 dark:ring-sky-400/40",
  },
  indigo: {
    dot: "bg-indigo-500 dark:bg-indigo-400",
    bg: "bg-indigo-500/10 dark:bg-indigo-400/15",
    text: "text-indigo-900 dark:text-indigo-200",
    ring: "ring-indigo-500/40 dark:ring-indigo-400/40",
  },
  violet: {
    dot: "bg-violet-500 dark:bg-violet-400",
    bg: "bg-violet-500/10 dark:bg-violet-400/15",
    text: "text-violet-900 dark:text-violet-200",
    ring: "ring-violet-500/40 dark:ring-violet-400/40",
  },
  rose: {
    dot: "bg-rose-500 dark:bg-rose-400",
    bg: "bg-rose-500/10 dark:bg-rose-400/15",
    text: "text-rose-900 dark:text-rose-200",
    ring: "ring-rose-500/40 dark:ring-rose-400/40",
  },
};

export function isGroupColorKey(value: string): value is GroupColorKey {
  return (GROUP_COLOR_KEYS as readonly string[]).includes(value);
}

export function resolveGroupColor(
  key: string | null | undefined,
): GroupColorClasses {
  const resolved: GroupColorKey = isGroupColorKey(key ?? "")
    ? (key as GroupColorKey)
    : "orange";
  return { key: resolved, ...PALETTE[resolved] };
}

/** Suggest an unused palette key; cycles from the start when all are used. */
export function nextGroupColor(usedKeys: Iterable<string>): GroupColorKey {
  const used = new Set(
    [...usedKeys].filter(isGroupColorKey) as GroupColorKey[],
  );
  for (const key of GROUP_COLOR_KEYS) {
    if (!used.has(key)) return key;
  }
  return GROUP_COLOR_KEYS[used.size % GROUP_COLOR_KEYS.length]!;
}
