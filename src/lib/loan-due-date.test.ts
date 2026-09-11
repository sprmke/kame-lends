import { describe, expect, it } from "vitest";
import {
  isLoanDueWithinMaturingWindow,
  isLoanPastDueByCalendarDate,
  isMaturingFundedLoan,
  isOverdueLoanForDashboard,
  toLoanDueDayKey,
} from "$lib/loan-due-date";
import { fromLocalDateString } from "$lib/date-utils";

const reference = fromLocalDateString("2026-09-10");

describe("loan due date windows", () => {
  it("includes loans due today in the maturing window", () => {
    expect(isLoanDueWithinMaturingWindow("2026-09-10", 14, reference)).toBe(
      true,
    );
  });

  it("includes loans due on the last day of the window", () => {
    expect(isLoanDueWithinMaturingWindow("2026-09-24", 14, reference)).toBe(
      true,
    );
  });

  it("excludes loans due yesterday from the maturing window", () => {
    expect(isLoanDueWithinMaturingWindow("2026-09-09", 14, reference)).toBe(
      false,
    );
  });

  it("excludes loans due after the window", () => {
    expect(isLoanDueWithinMaturingWindow("2026-09-25", 14, reference)).toBe(
      false,
    );
  });

  it("treats due today as not past due by calendar date", () => {
    expect(isLoanPastDueByCalendarDate("2026-09-10", reference)).toBe(false);
  });

  it("treats due yesterday as past due by calendar date", () => {
    expect(isLoanPastDueByCalendarDate("2026-09-09", reference)).toBe(true);
  });

  it("classifies funded loans due today as maturing", () => {
    expect(
      isMaturingFundedLoan(
        {
          status: "Fully Funded",
          dueDate: "2026-09-10",
        },
        reference,
      ),
    ).toBe(true);
  });

  it("does not classify funded loans due today as overdue", () => {
    expect(
      isOverdueLoanForDashboard(
        {
          status: "Fully Funded",
          dueDate: "2026-09-10",
        },
        reference,
      ),
    ).toBe(false);
  });

  it("normalizes UTC midnight due dates to the stored calendar day", () => {
    expect(toLoanDueDayKey("2026-09-10T00:00:00.000Z")).toBe("2026-09-10");
  });
});
