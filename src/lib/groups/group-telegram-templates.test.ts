import { describe, expect, it } from "vitest";
import {
  applyTelegramTemplate,
  DEFAULT_GROUP_TELEGRAM_TEMPLATES,
  GROUP_TELEGRAM_PREVIEW_SAMPLES,
  GROUP_TELEGRAM_TEMPLATE_KINDS,
  PREVIOUS_GROUP_TELEGRAM_TEMPLATES,
  resolveGroupTelegramTemplate,
  telegramTemplateRejection,
  templateKindForActivity,
} from "./group-telegram-templates";

describe("group telegram templates", () => {
  it("applies placeholders", () => {
    expect(
      applyTelegramTemplate("Hi {{loan_name}} on {{date}}", {
        loan_name: "Lot A",
        date: "Oct 1",
      }),
    ).toBe("Hi Lot A on Oct 1");
  });

  it("hides an empty if block and keeps a filled one", () => {
    const template = "A\n{{#if witnesses}}Witnesses: {{witnesses}}\n{{/if}}B";
    expect(applyTelegramTemplate(template, { witnesses: "" })).toBe("A\nB");
    expect(applyTelegramTemplate(template, { witnesses: "• Ana" })).toBe(
      "A\nWitnesses: • Ana\nB",
    );
  });

  it("leaves unknown tokens in place and hides unknown if keys", () => {
    expect(applyTelegramTemplate("{{nope}}", {})).toBe("{{nope}}");
    expect(applyTelegramTemplate("{{#if nope}}gone{{/if}}stay", {})).toBe(
      "stay",
    );
  });

  it("falls back to defaults", () => {
    const template = resolveGroupTelegramTemplate("test", {});
    expect(template).toContain("Test");
    expect(template).toContain("{{group_name}}");
  });

  it("uses stored override", () => {
    expect(
      resolveGroupTelegramTemplate("test", { test: "Custom {{group_link}}" }),
    ).toBe("Custom {{group_link}}");
  });

  it("treats a stored previous default as unset", () => {
    const previous = PREVIOUS_GROUP_TELEGRAM_TEMPLATES.upcoming ?? "";
    expect(
      resolveGroupTelegramTemplate("upcoming", { upcoming: previous }),
    ).toBe(DEFAULT_GROUP_TELEGRAM_TEMPLATES.upcoming);
    expect(
      resolveGroupTelegramTemplate("upcoming", {
        upcoming: "Hello {{loan_name}}",
      }),
    ).toBe("Hello {{loan_name}}");
  });

  it("maps payment activity onto the payment template", () => {
    expect(templateKindForActivity("payment_received")).toBe(
      "activity_payment",
    );
    expect(templateKindForActivity("interest_paid")).toBe("activity_payment");
    expect(templateKindForActivity("mystery")).toBe("activity");
  });

  it("renders every default without leftover tokens", () => {
    for (const kind of GROUP_TELEGRAM_TEMPLATE_KINDS) {
      const rendered = applyTelegramTemplate(
        DEFAULT_GROUP_TELEGRAM_TEMPLATES[kind],
        GROUP_TELEGRAM_PREVIEW_SAMPLES,
      );
      expect(rendered, kind).not.toContain("{{");
    }
  });

  it("puts the loan summary in reminder and payment defaults", () => {
    expect(DEFAULT_GROUP_TELEGRAM_TEMPLATES.upcoming).toContain("Borrower:");
    expect(DEFAULT_GROUP_TELEGRAM_TEMPLATES.upcoming).toContain("Investors:");
    expect(DEFAULT_GROUP_TELEGRAM_TEMPLATES.upcoming).toContain("Amount:");
    expect(DEFAULT_GROUP_TELEGRAM_TEMPLATES.activity_payment).toContain(
      "action_detail",
    );
    expect(DEFAULT_GROUP_TELEGRAM_TEMPLATES.unsigned).toContain(
      "pending_count",
    );
    expect(DEFAULT_GROUP_TELEGRAM_TEMPLATES.unsigned).toContain("pending_body");
  });

  it("rejects unknown tags and oversize text", () => {
    expect(telegramTemplateRejection("<b>Ok</b>")).toBeNull();
    expect(telegramTemplateRejection("<script>x</script>")).toBe(
      "Unsupported tag",
    );
    expect(telegramTemplateRejection("x".repeat(4001))).toBe(
      "Template is too long",
    );
  });
});
