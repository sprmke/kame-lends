import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  buildGroupTelegramActivityHtml,
  planGroupNotifications,
  type GroupNotificationSettings,
} from "./group-notification-plan";
import type { Investor, LoanWithInvestors } from "./types";

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

function loan(overrides: Partial<LoanWithInvestors> = {}): LoanWithInvestors {
  return {
    id: 10,
    borrowerId: null,
    loanName: "Sample Loan",
    type: "Agent",
    status: "Fully Funded",
    dueDate: new Date("2026-09-17T00:00:00.000Z"),
    freeLotSqm: null,
    notes: null,
    userId: "user-1",
    profitType: "rate",
    profitValue: "0",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    loanInvestors: [
      {
        id: 1,
        loanId: 10,
        investorId: 1,
        amount: "100000",
        interestRate: "10",
        interestType: "rate",
        sentDate: new Date("2026-09-01T00:00:00.000Z"),
        isPaid: true,
        hasMultipleInterest: false,
        profitType: "rate",
        profitValue: "0",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        investor,
      },
    ],
    ...overrides,
  };
}

const baseSettings: GroupNotificationSettings = {
  notifyUpcoming: true,
  reminderDays: [3, 1],
  notifyDueToday: true,
  notifyOverdue: true,
  overdueRepeatEveryDays: 1,
  notifyDailyDigest: true,
  includeAmounts: true,
};

describe("planGroupNotifications", () => {
  it("plans D-N upcoming reminders with stable fingerprints", () => {
    const todayKey = "2026-09-14";
    const planned = planGroupNotifications([loan()], baseSettings, todayKey, {
      groupId: 1,
    });
    const upcoming = planned.filter((p) => p.kind === "upcoming");
    expect(upcoming.map((p) => p.fingerprint)).toEqual([
      "upcoming:due:10:2026-09-17:D-3",
    ]);

    const userPush = planGroupNotifications([loan()], baseSettings, todayKey, {
      groupId: 0,
    });
    expect(
      userPush.filter((p) => p.kind === "upcoming").map((p) => p.fingerprint),
    ).toEqual(upcoming.map((p) => p.fingerprint));

    const dayBeforeDue = planGroupNotifications(
      [loan()],
      baseSettings,
      "2026-09-16",
    );
    expect(
      dayBeforeDue
        .filter((p) => p.kind === "upcoming")
        .map((p) => p.fingerprint),
    ).toEqual(["upcoming:due:10:2026-09-17:D-1"]);
  });

  it("plans due today with fingerprint due_today:<type>:<loanId>:<dateKey>", () => {
    const todayKey = "2026-09-17";
    const planned = planGroupNotifications([loan()], baseSettings, todayKey);
    expect(
      planned.some((p) => p.fingerprint === "due_today:due:10:2026-09-17"),
    ).toBe(true);
  });

  it("repeats overdue on schedule using todayKey in fingerprint", () => {
    const todayKey = "2026-09-18";
    const settings = { ...baseSettings, overdueRepeatEveryDays: 2 };
    const day1 = planGroupNotifications([loan()], settings, todayKey);
    expect(day1.some((p) => p.kind === "overdue")).toBe(true);
    const day2 = planGroupNotifications(
      [loan()],
      settings,
      addDaysToDateKey(todayKey, 1),
    );
    expect(day2.some((p) => p.kind === "overdue")).toBe(false);
  });

  it("includes digest fingerprint digest:<todayKey>", () => {
    const todayKey = "2026-09-14";
    const planned = planGroupNotifications([loan()], baseSettings, todayKey);
    expect(planned.some((p) => p.fingerprint === `digest:${todayKey}`)).toBe(
      true,
    );
  });

  it("skips completed loans for overdue", () => {
    const todayKey = "2026-09-20";
    const planned = planGroupNotifications(
      [loan({ status: "Completed" })],
      baseSettings,
      todayKey,
    );
    expect(planned.filter((p) => p.kind === "overdue")).toHaveLength(0);
  });

  it("renders a loan summary on upcoming reminders", () => {
    const planned = planGroupNotifications(
      [loan()],
      baseSettings,
      "2026-09-14",
      {
        groupId: 4,
        groupName: "Agents",
      },
    );
    const html = planned.find((row) => row.kind === "upcoming")?.html ?? "";
    expect(html).toContain("Sample Loan");
    expect(html).toContain("No borrower");
    expect(html).toContain("Ada");
    expect(html).toContain("Due in 3 days");
    expect(html).not.toContain("{{");
  });

  it("keeps a custom upcoming template", () => {
    const planned = planGroupNotifications(
      [loan()],
      baseSettings,
      "2026-09-14",
      {
        templates: { upcoming: "Hello {{loan_name}}" },
      },
    );
    expect(planned.find((row) => row.kind === "upcoming")?.html).toBe(
      "Hello Sample Loan",
    );
  });

  it("says Hidden when amounts are off", () => {
    const planned = planGroupNotifications(
      [loan()],
      { ...baseSettings, includeAmounts: false },
      "2026-09-17",
    );
    const html = planned.find((row) => row.kind === "due_today")?.html ?? "";
    expect(html).toContain("Hidden");
    expect(html).not.toContain("—");
    expect(html).not.toContain("Due in");
    expect(html).not.toContain("Overdue by");
  });

  it("counts days overdue", () => {
    const planned = planGroupNotifications(
      [loan()],
      baseSettings,
      "2026-09-18",
    );
    const html = planned.find((row) => row.kind === "overdue")?.html ?? "";
    expect(html).toContain("Overdue by 1 day");
  });

  it("uses the empty notice when the next week has nothing due", () => {
    const planned = planGroupNotifications(
      [loan({ dueDate: new Date("2026-12-01T00:00:00.000Z") })],
      baseSettings,
      "2026-09-14",
    );
    const html = planned.find((row) => row.kind === "digest")?.html ?? "";
    expect(html).toContain("Nothing due in the next 7 days.");
  });
});

describe("buildGroupTelegramActivityHtml", () => {
  it("uses the loaded loan when the summary is only a name", () => {
    const html = buildGroupTelegramActivityHtml({
      type: "loan_updated",
      summary: "Lot A",
      loan: loan({ loanName: "Lot A", borrower: undefined }),
      appUrl: "https://app.example",
      groupId: 2,
      groupName: "Agents",
      includeAmounts: true,
      loanId: 10,
    });
    expect(html).toContain("Loan updated");
    expect(html).toContain("Lot A");
    expect(html).toContain("Ada");
    expect(html).toContain("No borrower");
    expect(html).not.toBe("Lot A");
  });

  it("includes a disbursement amount from the event detail", () => {
    const html = buildGroupTelegramActivityHtml({
      type: "disbursement",
      summary: "Disbursement on Sample Loan",
      loan: loan(),
      appUrl: "https://app.example",
      groupId: 2,
      groupName: "Agents",
      includeAmounts: true,
      detail: { amount: 50000, date: "2026-10-01", investorName: "Ada" },
    });
    expect(html).toContain("₱50,000 from Ada on Oct 1, 2026");
  });
});
