import { describe, expect, it } from "vitest";
import {
  buildDigestPlan,
  daysSinceInvitation,
  dueReminderFingerprint,
  isDueReminderEnabled,
  planDueReminders,
  signingReminderFingerprint,
  type PlannedSigningReminder,
  type ReminderPreferenceFlags,
} from "$lib/email/reminder-plan";
import type { Investor, LoanWithInvestors } from "$lib/types";

const investor: Investor = {
  id: 1,
  name: "Ada",
  email: "ada@example.com",
  contactNumber: null,
  address: null,
  validIdUrl: null,
  eSignatureUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function loan(dueDate: string): LoanWithInvestors {
  return {
    id: 10,
    borrowerId: null,
    loanName: "Agent Loan",
    type: "Agent",
    status: "Fully Funded",
    dueDate: new Date(`${dueDate}T00:00:00.000Z`),
    freeLotSqm: null,
    notes: null,
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    loanInvestors: [
      {
        id: 11,
        loanId: 10,
        investorId: 1,
        amount: "100000",
        interestRate: "10",
        interestType: "rate",
        sentDate: new Date("2026-06-01T00:00:00.000Z"),
        isPaid: true,
        hasMultipleInterest: false,
        profitType: "rate",
        profitValue: "0",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        investor,
        interestPeriods: [],
        receivedPayments: [],
      } as unknown as LoanWithInvestors["loanInvestors"][number],
    ],
  };
}

function prefs(
  overrides: Partial<ReminderPreferenceFlags> = {},
): ReminderPreferenceFlags {
  return {
    emailEnabled: true,
    notifyDueReminders: true,
    reminderDays: [3, 1],
    notifyDueToday: true,
    notifyOverdue: true,
    overdueRepeatEveryDays: 3,
    notifySigningReminders: true,
    signingReminderFirstAfterDays: 3,
    signingReminderRepeatEveryDays: 3,
    ...overrides,
  };
}

function signing(
  overrides: Partial<PlannedSigningReminder> = {},
): PlannedSigningReminder {
  return {
    invitationId: 7,
    loanId: 10,
    loanName: "Agent Loan",
    dueDateKey: "2026-06-30",
    partyEmail: "ada@example.com",
    partyName: "Ada",
    createdAt: new Date("2026-06-20T00:00:00.000Z"),
    daysSinceCreated: 5,
    ...overrides,
  };
}

describe("planDueReminders", () => {
  it("plans D-3 and D-1 upcoming reminders", () => {
    const items = planDueReminders([loan("2026-06-30")], "2026-06-27");
    const target = items.find((item) => item.dateKey === "2026-06-30");
    expect(target?.daysUntil).toBe(3);
    expect(isDueReminderEnabled(target!, prefs())).toBe(true);

    const d1 = planDueReminders([loan("2026-06-30")], "2026-06-29").find(
      (item) => item.dateKey === "2026-06-30",
    );
    expect(d1?.daysUntil).toBe(1);
    expect(isDueReminderEnabled(d1!, prefs())).toBe(true);
  });

  it("filters lead days that are not selected", () => {
    const item = planDueReminders([loan("2026-06-30")], "2026-06-28").find(
      (row) => row.dateKey === "2026-06-30",
    );
    expect(item?.daysUntil).toBe(2);
    expect(isDueReminderEnabled(item!, prefs())).toBe(false);
  });

  it("splits due today and overdue", () => {
    const dueToday = planDueReminders([loan("2026-06-30")], "2026-06-30").find(
      (row) => row.dateKey === "2026-06-30",
    );
    expect(dueToday?.daysUntil).toBe(0);
    expect(dueReminderFingerprint(dueToday!, prefs())).toBe(
      "due:today:10:2026-06-30",
    );

    const overdue = planDueReminders([loan("2026-06-30")], "2026-07-01").find(
      (row) => row.dateKey === "2026-06-30",
    );
    expect(overdue?.daysUntil).toBe(-1);
    expect(dueReminderFingerprint(overdue!, prefs())).toBe(
      "due:overdue:10:2026-06-30:g1",
    );
  });

  it("repeats overdue on the configured cadence", () => {
    const day2 = planDueReminders([loan("2026-06-30")], "2026-07-02").find(
      (row) => row.dateKey === "2026-06-30",
    );
    const day4 = planDueReminders([loan("2026-06-30")], "2026-07-04").find(
      (row) => row.dateKey === "2026-06-30",
    );
    expect(dueReminderFingerprint(day2!, prefs())).toBe(
      dueReminderFingerprint(
        planDueReminders([loan("2026-06-30")], "2026-07-01").find(
          (row) => row.dateKey === "2026-06-30",
        )!,
        prefs(),
      ),
    );
    expect(dueReminderFingerprint(day4!, prefs())).toBe(
      "due:overdue:10:2026-06-30:g2",
    );
  });

  it("honors the overdue repeat of one day", () => {
    const day2 = planDueReminders([loan("2026-06-30")], "2026-07-02").find(
      (row) => row.dateKey === "2026-06-30",
    );
    expect(
      dueReminderFingerprint(day2!, prefs({ overdueRepeatEveryDays: 1 })),
    ).toBe("due:overdue:10:2026-06-30:g2");
  });
});

describe("signing reminders", () => {
  it("waits for the first delay", () => {
    expect(
      signingReminderFingerprint(signing({ daysSinceCreated: 2 }), prefs()),
    ).toBeNull();
  });

  it("repeats on the configured cadence", () => {
    expect(
      signingReminderFingerprint(signing({ daysSinceCreated: 3 }), prefs()),
    ).toBe("signing:7:g1");
    expect(
      signingReminderFingerprint(signing({ daysSinceCreated: 5 }), prefs()),
    ).toBe("signing:7:g1");
    expect(
      signingReminderFingerprint(signing({ daysSinceCreated: 6 }), prefs()),
    ).toBe("signing:7:g2");
  });

  it("counts days from the invitation date in Manila", () => {
    expect(daysSinceInvitation("2026-06-20T00:00:00.000Z", "2026-06-23")).toBe(
      3,
    );
  });
});

describe("buildDigestPlan", () => {
  it("returns null when every category is off", () => {
    const due = planDueReminders([loan("2026-06-30")], "2026-06-30").find(
      (row) => row.dateKey === "2026-06-30",
    )!;
    const plan = buildDigestPlan({
      dueItems: [due],
      signingItems: [],
      prefs: prefs({ notifyDueToday: false }),
      appUrl: "https://example.com",
      todayKey: "2026-06-30",
    });
    expect(plan).toBeNull();
  });

  it("combines signatures and due items in one stable digest", () => {
    const due = planDueReminders([loan("2026-06-30")], "2026-06-27").find(
      (row) => row.dateKey === "2026-06-30",
    )!;
    const plan = buildDigestPlan({
      dueItems: [due],
      signingItems: [signing({ daysSinceCreated: 4 })],
      prefs: prefs(),
      appUrl: "https://example.com",
      todayKey: "2026-06-27",
    });

    expect(plan).not.toBeNull();
    expect(plan?.sections.signatures).toHaveLength(1);
    expect(plan?.sections.upcoming).toHaveLength(1);
    expect(plan?.fingerprint).toContain("signing:7:g1");
    expect(plan?.fingerprint).toContain("due:upcoming:10:2026-06-30:d3");

    const repeat = buildDigestPlan({
      dueItems: [due],
      signingItems: [signing({ daysSinceCreated: 4 })],
      prefs: prefs(),
      appUrl: "https://example.com",
      todayKey: "2026-06-27",
    });
    expect(repeat?.fingerprint).toBe(plan?.fingerprint);
  });
});
