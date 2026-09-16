import { describe, expect, it } from "vitest";
import {
  googleCalendarColorIdForKind,
  kindFromEventSummary,
  kindFromKameKey,
  resolveGoogleCalendarEventKind,
} from "./calendar-event-colors";

describe("calendar-event-colors", () => {
  it("maps kinds to legacy Google color ids", () => {
    expect(googleCalendarColorIdForKind("sent")).toBe("11");
    expect(googleCalendarColorIdForKind("due")).toBe("2");
    expect(googleCalendarColorIdForKind("interest_due")).toBe("7");
    expect(googleCalendarColorIdForKind("summary")).toBe("8");
  });

  it("parses kameKey", () => {
    expect(kindFromKameKey("summary-2026-09-17")).toBe("summary");
    expect(kindFromKameKey("loan-42-sent-2026-09-01")).toBe("sent");
    expect(kindFromKameKey("loan-42-interest_due-2026-09-15")).toBe(
      "interest_due",
    );
  });

  it("parses summary titles", () => {
    expect(kindFromEventSummary("Total Summary +₱275,000")).toBe("summary");
    expect(kindFromEventSummary("Agent: Foo - Disbursement (-₱100,000)")).toBe(
      "sent",
    );
    expect(kindFromEventSummary("OR/CR: Bar - Due Date (+₱50,000)")).toBe(
      "due",
    );
    expect(
      kindFromEventSummary("Lot Title: Baz - Interest Due (+₱5,000)"),
    ).toBe("interest_due");
  });

  it("prefers kameKey over summary", () => {
    expect(
      resolveGoogleCalendarEventKind({
        kameKey: "loan-1-due-2026-01-01",
        summary: "Agent: X - Disbursement (-₱1)",
      }),
    ).toBe("due");
  });
});
