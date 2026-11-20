import { render } from "svelte/server";
import { describe, expect, it, vi } from "vitest";
import InvestorInterestSection from "./InvestorInterestSection.svelte";
import {
  computeInvestorMetrics,
  type InvestorWithTransactions,
} from "./investor-transactions-helpers";

function singlePaymentItem(): InvestorWithTransactions {
  return {
    investor: { id: 2, name: "Arianna Perez", email: "arianna@example.com" },
    transactions: [
      {
        id: 10,
        amount: "50000",
        interestRate: "10",
        interestType: "rate",
        sentDate: "2026-11-21",
        isPaid: true,
      },
    ],
    hasMultipleInterest: false,
    interestPeriods: [],
    receivedPayments: [
      {
        id: 99,
        amount: "55000",
        receivedDate: "2026-12-01",
        interestPeriodId: null,
        receipts: [],
        notes: null,
      },
    ],
  };
}

describe("InvestorInterestSection single repayment", () => {
  it("exposes edit and remove actions for a general received payment", () => {
    const item = singlePaymentItem();
    const metrics = computeInvestorMetrics(item, 50000);
    const { body } = render(InvestorInterestSection, {
      props: {
        metrics,
        transactions: item.transactions,
        loanTotalPrincipal: 50000,
        open: true,
        onOpenChange: vi.fn(),
        showPeriodStatus: true,
        canMutate: true,
        deletingPaymentIds: new Set<number>(),
        completingPeriods: new Set<number | string>(),
        editingPaymentPeriodIds: new Set<number>(),
        onDeletePayment: vi.fn(),
        onComplete: vi.fn(),
        onEditPayment: vi.fn(),
        onEditGeneralPayment: vi.fn(),
      },
    });
    expect(body).toContain('aria-label="Edit payment"');
    expect(body).toContain('aria-label="Remove payment"');
  });
});
