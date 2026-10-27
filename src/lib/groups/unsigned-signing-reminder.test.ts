import { describe, expect, it } from "vitest";
import {
  manilaHour,
  planUnsignedSigningReminder,
  signingReminderSlot,
  type UnsignedLoanInput,
  type UnsignedSigningSettings,
} from "./unsigned-signing-reminder";

const settings: UnsignedSigningSettings = {
  notifyUnsigned: true,
  intervalHours: 1,
  requireBorrower: true,
  requireInvestor: true,
  requireWitness: false,
};

function loan(overrides: Partial<UnsignedLoanInput> = {}): UnsignedLoanInput {
  return {
    id: 10,
    loanName: "Lot A",
    status: "Fully Funded",
    loanType: "OR/CR",
    dueDate: new Date("2026-10-16T00:00:00.000Z"),
    principal: 120000,
    invitations: [
      {
        partyRole: "borrower",
        partyName: "Maria Cruz",
        signedAt: null,
      },
      {
        partyRole: "lender",
        partyName: "Juan Reyes",
        signedAt: null,
      },
      {
        partyRole: "witness_1",
        partyName: "Ana Lim",
        signedAt: null,
      },
    ],
    ...overrides,
  };
}

const now = new Date("2026-10-17T00:00:00.000Z");

describe("signing reminder clock", () => {
  it("reads Manila hour and aligns slots", () => {
    expect(manilaHour(now)).toBe(8);
    expect(signingReminderSlot(now, 1)).toBe("2026-10-17:8");
    expect(signingReminderSlot(now, 4)).toBe("2026-10-17:2");
    expect(signingReminderSlot(now, 24)).toBe("2026-10-17:daily");
    expect(signingReminderSlot(new Date("2026-10-17T01:00:00.000Z"), 2)).toBe(
      null,
    );
    expect(signingReminderSlot(new Date("2026-10-17T01:00:00.000Z"), 24)).toBe(
      null,
    );
  });
});

describe("planUnsignedSigningReminder", () => {
  it("lists unsigned borrower and investor, and skips witness by default", () => {
    const planned = planUnsignedSigningReminder([loan()], settings, now, {
      appUrl: "https://app.example",
      groupId: 3,
    });
    expect(planned?.fingerprint).toBe("unsigned:2026-10-17:8");
    expect(planned?.kind).toBe("unsigned");
    expect(planned?.html).toContain("Signatures still needed");
    expect(planned?.html).toContain("Due Oct 16, 2026");
    expect(planned?.html).toContain("₱120,000");
    expect(planned?.html).toContain("Maria Cruz, Borrower");
    expect(planned?.html).toContain("Juan Reyes, Investor");
    expect(planned?.html).not.toContain("Ana Lim");
    expect(planned?.html).toContain('href="https://app.example/loans/10"');
    expect(planned?.html).toContain('href="https://app.example/groups/3"');
  });

  it("includes witnesses when the group requires them", () => {
    const planned = planUnsignedSigningReminder(
      [loan()],
      { ...settings, requireWitness: true },
      now,
      { appUrl: "https://app.example", groupId: 3 },
    );
    expect(planned?.html).toContain("Ana Lim, Witness");
  });

  it("drops people who already signed and completed loans", () => {
    const planned = planUnsignedSigningReminder(
      [
        loan({
          invitations: [
            {
              partyRole: "borrower",
              partyName: "Maria Cruz",
              signedAt: "2026-10-01T00:00:00.000Z",
            },
            {
              partyRole: "lender",
              partyName: "Juan Reyes",
              signedAt: null,
            },
          ],
        }),
        loan({
          id: 11,
          loanName: "Closed",
          status: "Completed",
          invitations: [
            {
              partyRole: "borrower",
              partyName: "Done Person",
              signedAt: null,
            },
          ],
        }),
      ],
      settings,
      now,
      { appUrl: "https://app.example", groupId: 3 },
    );
    expect(planned?.html).toContain("Juan Reyes, Investor");
    expect(planned?.html).not.toContain("Maria Cruz");
    expect(planned?.html).not.toContain("Done Person");
    expect(planned?.html).not.toContain("Closed");
  });

  it("stays quiet when everyone required has signed", () => {
    const planned = planUnsignedSigningReminder(
      [
        loan({
          invitations: [
            {
              partyRole: "borrower",
              partyName: "Maria Cruz",
              signedAt: now,
            },
            {
              partyRole: "lender",
              partyName: "Juan Reyes",
              signedAt: now,
            },
          ],
        }),
      ],
      settings,
      now,
      { appUrl: "https://app.example", groupId: 3 },
    );
    expect(planned).toBeNull();
  });

  it("stays quiet outside the chosen interval", () => {
    const planned = planUnsignedSigningReminder(
      [loan()],
      { ...settings, intervalHours: 24 },
      new Date("2026-10-17T01:00:00.000Z"),
      { appUrl: "https://app.example", groupId: 3 },
    );
    expect(planned).toBeNull();
  });

  it("escapes names in the waiting list", () => {
    const planned = planUnsignedSigningReminder(
      [
        loan({
          loanName: "A & B",
          invitations: [
            {
              partyRole: "borrower",
              partyName: "<script>",
              signedAt: null,
            },
          ],
        }),
      ],
      { ...settings, requireInvestor: false },
      now,
      { appUrl: "https://app.example", groupId: 3 },
    );
    expect(planned?.html).toContain("A &amp; B");
    expect(planned?.html).toContain("&lt;script&gt;, Borrower");
    expect(planned?.html).not.toContain("<script>");
  });
});
