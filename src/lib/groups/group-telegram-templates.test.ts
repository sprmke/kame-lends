import { describe, expect, it } from "vitest";
import {
  applyTelegramTemplate,
  resolveGroupTelegramTemplate,
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

  it("falls back to defaults", () => {
    const template = resolveGroupTelegramTemplate("test", {});
    expect(template).toContain("Test");
  });

  it("uses stored override", () => {
    expect(
      resolveGroupTelegramTemplate("test", { test: "Custom {{group_link}}" }),
    ).toBe("Custom {{group_link}}");
  });
});
