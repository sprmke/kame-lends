const TOKEN_PATTERN = /(\{\{[^}]+\}\})/g;
const TOKEN_TEST = /^\{\{[^}]+\}\}$/;

export type TemplateTextPart = {
  kind: "text" | "token";
  text: string;
};

/** Strip trailing line whitespace and collapse runaway blank lines. */
export function normalizeTelegramTemplateText(text: string): string {
  let out = text.replace(/\r\n/g, "\n");
  out = out
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

function placeholderKey(part: string): string | null {
  if (!TOKEN_TEST.test(part)) return null;
  return part.slice(2, -2).trim().toLowerCase();
}

/** Split template text so known `{{tokens}}` can be highlighted. */
export function splitTemplateHighlightParts(
  text: string,
  validKeys?: ReadonlySet<string>,
): TemplateTextPart[] {
  if (!text) return [];
  return text
    .split(TOKEN_PATTERN)
    .filter((part) => part !== "")
    .map((part) => {
      const key = placeholderKey(part);
      const known =
        key !== null &&
        (!validKeys || validKeys.size === 0 || validKeys.has(key));
      return known
        ? { kind: "token" as const, text: part }
        : { kind: "text" as const, text: part };
    });
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Escape preview text, then restore Telegram inline tags (`b`, `i`). */
export function formatTelegramPreviewText(text: string): string {
  return escapeHtml(text).replace(
    /&lt;(\/?)(b|i)&gt;/gi,
    (_match, slash: string, tag: string) => {
      return `<${slash}${tag.toLowerCase()}>`;
    },
  );
}
