import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUP_TELEGRAM_TEMPLATES,
  GROUP_TELEGRAM_PREVIEW_SAMPLES,
  applyTelegramTemplate,
} from "./group-telegram-templates";
import {
  formatTelegramPreviewText,
  normalizeTelegramTemplateText,
  splitTemplateHighlightParts,
} from "./telegram-template-highlight";

const keys = new Set(["loan_name", "date"]);

describe("telegram template highlight", () => {
  it("marks known placeholders and leaves unknown tokens as text", () => {
    expect(
      splitTemplateHighlightParts("Hi {{loan_name}} on {{nope}}", keys),
    ).toEqual([
      { kind: "text", text: "Hi " },
      { kind: "token", text: "{{loan_name}}" },
      { kind: "text", text: " on " },
      { kind: "text", text: "{{nope}}" },
    ]);
  });

  it("treats spaced keys as known", () => {
    expect(splitTemplateHighlightParts("{{ loan_name }}", keys)).toEqual([
      { kind: "token", text: "{{ loan_name }}" },
    ]);
  });

  it("normalizes trailing space and extra blank lines", () => {
    expect(normalizeTelegramTemplateText("Hello  \r\n\n\n\nNext  ")).toBe(
      "Hello\n\nNext",
    );
  });

  it("escapes preview html and keeps bold and italic", () => {
    expect(formatTelegramPreviewText("<b>Hi</b> <script>x</script>")).toBe(
      "<b>Hi</b> &lt;script&gt;x&lt;/script&gt;",
    );
  });

  it("previews a default reminder with the heading in bold", () => {
    const rendered = applyTelegramTemplate(
      DEFAULT_GROUP_TELEGRAM_TEMPLATES.upcoming,
      GROUP_TELEGRAM_PREVIEW_SAMPLES,
    );
    const html = splitTemplateHighlightParts(rendered)
      .map((part) =>
        part.kind === "token"
          ? part.text
          : formatTelegramPreviewText(part.text),
      )
      .join("");
    expect(html).toContain("<b>Upcoming in 3 days</b>");
    expect(html).not.toContain("{{");
  });
});
