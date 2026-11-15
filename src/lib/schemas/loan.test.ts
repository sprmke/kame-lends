import { describe, expect, it } from "vitest";
import { firstLoanWriteError, loanWriteSchema } from "./loan";

function basePayload() {
  return {
    loanData: {
      borrowerId: 1,
      loanName: "Test loan",
      type: "Lot Title",
      dueDate: "2026-06-30",
      notes: "",
    },
    investorData: [
      {
        investorId: 2,
        amount: "100000",
        interestRate: "3",
        interestType: "rate",
        sentDate: "2026-01-01",
        hasMultipleInterest: false,
        receipts: [],
        interestPeriods: [
          { dueDate: "2026-03-31", interestRate: "3", interestType: "rate" },
        ],
      },
    ],
  };
}

describe("loan write schema", () => {
  it("accepts a complete payload and parses money once", () => {
    const parsed = loanWriteSchema.safeParse(basePayload());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.investorData[0].amount).toBe(100000);
    expect(parsed.data.investorData[0].sentDate.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("rejects an empty interest period value (DATA-03)", () => {
    const payload = basePayload();
    payload.investorData[0].interestPeriods[0].interestRate = "";
    const parsed = loanWriteSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(firstLoanWriteError(parsed.error)).toMatch(/interest/i);
  });

  it("rejects a zero interest period value", () => {
    const payload = basePayload();
    payload.investorData[0].interestPeriods[0].interestRate = "0";
    expect(loanWriteSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects NaN and negative amounts", () => {
    const nan = basePayload();
    nan.investorData[0].amount = "abc";
    expect(loanWriteSchema.safeParse(nan).success).toBe(false);

    const negative = basePayload();
    negative.investorData[0].amount = "-1";
    expect(loanWriteSchema.safeParse(negative).success).toBe(false);
  });

  it("rejects a sent date after the loan due date", () => {
    const payload = basePayload();
    payload.investorData[0].sentDate = "2026-07-01";
    expect(loanWriteSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an interest period after the loan due date", () => {
    const payload = basePayload();
    payload.investorData[0].interestPeriods[0].dueDate = "2026-08-01";
    expect(loanWriteSchema.safeParse(payload).success).toBe(false);
  });

  it("requires periods when multiple interest is on", () => {
    const payload = basePayload();
    payload.investorData[0].hasMultipleInterest = true;
    payload.investorData[0].interestPeriods = [];
    const parsed = loanWriteSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("accepts a fixed period and rejects an empty fixed amount", () => {
    const ok = basePayload();
    ok.investorData[0].interestPeriods[0].interestType = "fixed";
    ok.investorData[0].interestPeriods[0].interestRate = "2500";
    expect(loanWriteSchema.safeParse(ok).success).toBe(true);

    const empty = basePayload();
    empty.investorData[0].interestPeriods[0].interestType = "fixed";
    empty.investorData[0].interestPeriods[0].interestRate = "";
    expect(loanWriteSchema.safeParse(empty).success).toBe(false);
  });

  it("requires at least one investor", () => {
    const payload = basePayload();
    payload.investorData = [];
    expect(loanWriteSchema.safeParse(payload).success).toBe(false);
  });

  it("keeps payment ids and period links from the form", () => {
    const payload = {
      ...basePayload(),
      receivedPaymentsByInvestor: [
        {
          investorId: 2,
          receivedPayments: [
            {
              id: "41",
              interestPeriodId: 77,
              amount: "3000",
              receivedDate: "2026-03-31",
              receipts: [],
            },
          ],
        },
      ],
    } as unknown as Parameters<typeof loanWriteSchema.safeParse>[0];
    const parsed = loanWriteSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const payment =
      parsed.data.receivedPaymentsByInvestor[0].receivedPayments[0];
    expect(payment.interestPeriodId).toBe(77);
    expect(payment.amount).toBe(3000);
  });
});
