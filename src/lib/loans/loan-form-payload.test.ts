import { describe, expect, it } from "vitest";
import {
  buildInvestorPayload,
  buildReceivedPaymentsPayload,
  validateLoanForm,
} from "./loan-form-payload";
import type { SelectedInvestorAllocation } from "$lib/components/loans/loan-form-types";

const receipt = {
  imageUrl: "data:image/png;base64,iVBORw0KGgo=",
  extractedData: null,
};

function allocation(
  overrides: Partial<SelectedInvestorAllocation> = {},
): SelectedInvestorAllocation {
  return {
    investor: { id: 7, name: "Ana" } as never,
    hasMultipleInterest: false,
    interestPeriods: [],
    receivedPayments: [],
    transactions: [
      {
        id: "11",
        amount: "100000",
        sentDate: "2026-01-15",
        interestType: "rate",
        interestRate: "3",
        interestAmount: "",
        isPaid: true,
        dateTouched: true,
        receipts: [receipt],
        notes: "",
      },
    ],
    ...overrides,
  };
}

describe("loan form payload", () => {
  it("keeps stable allocation and period ids", () => {
    const rows = buildInvestorPayload([
      allocation({
        hasMultipleInterest: true,
        interestPeriods: [
          {
            id: "21",
            dueDate: "2026-06-30",
            interestRate: "3",
            interestAmount: "",
            interestType: "rate",
          },
          {
            id: "temp-period",
            dueDate: "2026-12-31",
            interestRate: "3",
            interestAmount: "",
            interestType: "rate",
          },
        ],
      }),
    ]);

    expect(rows[0].id).toBe(11);
    expect(rows[0].interestPeriods?.[0].id).toBe(21);
    expect(rows[0].interestPeriods?.[1].id).toBeUndefined();
  });

  it("accepts multiple periods without a separate transaction interest value", () => {
    const item = allocation({
      hasMultipleInterest: true,
      transactions: [
        {
          ...allocation().transactions[0],
          interestRate: "",
        },
      ],
      interestPeriods: [
        {
          id: "21",
          dueDate: "2027-01-31",
          interestRate: "2",
          interestAmount: "",
          interestType: "rate",
        },
      ],
    });
    const errors = validateLoanForm({
      loanName: "Multi",
      dueDate: "2027-03-31",
      borrowerId: "1",
      selectedInvestors: [item],
    });
    expect(errors.investors).toBeUndefined();

    const rows = buildInvestorPayload([item]);
    expect(rows[0].interestRate).toBe("0");
    expect(rows[0].hasMultipleInterest).toBe(true);
  });
  it("never converts a zero-capital agent rate to a fixed amount (D-1)", () => {
    const rows = buildInvestorPayload([
      allocation({
        transactions: [
          {
            id: "temp-1",
            amount: "0",
            sentDate: "2026-01-15",
            interestType: "rate",
            interestRate: "3",
            interestAmount: "",
            isPaid: true,
            dateTouched: true,
            receipts: [receipt],
            notes: "",
          },
        ],
      }),
    ]);

    expect(rows[0].amount).toBe("0");
    expect(rows[0].interestType).toBe("rate");
    expect(rows[0].interestRate).toBe("3");
  });

  it("builds received payments with their period links and drops empty rows", () => {
    const rows = buildReceivedPaymentsPayload([
      allocation({
        receivedPayments: [
          {
            id: "51",
            interestPeriodId: 21,
            amount: "3000",
            receivedDate: "2026-06-30",
            receipts: [receipt],
            notes: "",
          },
          {
            id: "52",
            interestPeriodId: null,
            amount: "0",
            receivedDate: "2026-06-30",
            receipts: [],
            notes: "",
          },
        ],
      }),
    ]);

    expect(rows[0].receivedPayments).toHaveLength(1);
    expect(rows[0].receivedPayments[0].interestPeriodId).toBe(21);
  });
});

describe("loan form validation", () => {
  const base = {
    loanName: "Toyota Vios",
    dueDate: "2026-12-31",
    borrowerId: "1",
    selectedInvestors: [allocation()],
  };

  it("accepts a valid loan", () => {
    expect(validateLoanForm(base)).toEqual({});
  });

  it("requires a name, borrower, and investor", () => {
    const errors = validateLoanForm({
      ...base,
      loanName: "",
      borrowerId: "",
      selectedInvestors: [],
    });
    expect(errors.loanName).toBeTruthy();
    expect(errors.borrowerId).toBeTruthy();
    expect(errors.investors).toBeTruthy();
  });

  it("rejects an empty interest value on a period", () => {
    const errors = validateLoanForm({
      ...base,
      selectedInvestors: [
        allocation({
          hasMultipleInterest: true,
          interestPeriods: [
            {
              id: "p1",
              dueDate: "2026-06-30",
              interestRate: "",
              interestAmount: "",
              interestType: "rate",
            },
          ],
        }),
      ],
    });
    expect(errors.investors).toMatch(/greater than zero/);
  });

  it("rejects duplicate period dates", () => {
    const errors = validateLoanForm({
      ...base,
      selectedInvestors: [
        allocation({
          hasMultipleInterest: true,
          interestPeriods: [
            {
              id: "p1",
              dueDate: "2026-06-30",
              interestRate: "3",
              interestAmount: "",
              interestType: "rate",
            },
            {
              id: "p2",
              dueDate: "2026-06-30",
              interestRate: "3",
              interestAmount: "",
              interestType: "rate",
            },
          ],
        }),
      ],
    });
    expect(errors.investors).toMatch(/same due date/);
  });

  it("requires a receipt for a new disbursement", () => {
    const errors = validateLoanForm({
      ...base,
      selectedInvestors: [
        allocation({
          transactions: [
            {
              id: "temp-1",
              amount: "100000",
              sentDate: "2026-01-15",
              interestType: "rate",
              interestRate: "3",
              interestAmount: "",
              isPaid: true,
              dateTouched: true,
              receipts: [],
              notes: "",
            },
          ],
        }),
      ],
    });
    expect(errors.investors).toMatch(/receipt/i);
  });

  it("blocks received payments above the amount due", () => {
    const errors = validateLoanForm({
      ...base,
      selectedInvestors: [
        allocation({
          receivedPayments: [
            {
              id: "rp-1",
              interestPeriodId: null,
              amount: "200000",
              receivedDate: "2026-06-30",
              receipts: [receipt],
              notes: "",
            },
          ],
        }),
      ],
    });
    expect(errors.investors).toMatch(/cannot exceed/);
  });
});
