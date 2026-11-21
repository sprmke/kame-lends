import { describe, expect, it } from "vitest";
import {
  formatEmailDateKey,
  renderEventEmail,
  renderReminderDigest,
  type EmailRecipient,
} from "$lib/server/email/notifications";
import { defaultEmailPreferences } from "$lib/server/email/preferences";

function recipient(overrides: Partial<EmailRecipient> = {}): EmailRecipient {
  return {
    email: "maria@example.com",
    userId: "user-1",
    name: "Maria",
    roleLabels: ["Borrower"],
    preferences: defaultEmailPreferences("user-1"),
    ...overrides,
  };
}

const baseLoan = {
  id: 42,
  loanName: "Alpha Loan",
  type: "Lot Title",
  status: "Fully Funded",
  dueDate: "2026-10-01T00:00:00.000Z",
  borrowerName: "Maria",
  principal: 100000,
  investorNames: ["Ada"],
};

describe("formatEmailDateKey", () => {
  it("formats a business date without server timezone drift", () => {
    expect(formatEmailDateKey("2026-10-01")).toBe("Oct 1, 2026");
  });
});

describe("renderEventEmail", () => {
  it("renders a loan update with details and a CTA", () => {
    const built = renderEventEmail({
      event: {
        type: "loan_updated",
        loan: baseLoan,
        actorName: "Owner",
        appUrl: "https://example.com",
      },
      recipient: recipient(),
    });

    expect(built.subject).toBe("Kame Lends: Alpha Loan was updated");
    expect(built.html).toContain("Owner updated");
    expect(built.html).toContain("Alpha Loan");
    expect(built.html).toContain("Oct 1, 2026");
    expect(built.html).toContain("https://example.com/loans/42");
    expect(built.html).toContain("View loan");
  });

  it("escapes party-supplied text", () => {
    const built = renderEventEmail({
      event: {
        type: "loan_updated",
        loan: {
          ...baseLoan,
          loanName: '<script>alert("x")</script>',
          borrowerName: "A & B",
        },
        appUrl: "https://example.com",
      },
      recipient: recipient(),
    });

    expect(built.html).not.toContain("<script>");
    expect(built.html).toContain("&lt;script&gt;");
    expect(built.html).toContain("A &amp; B");
  });

  it("hides amounts when the recipient turns them off", () => {
    const built = renderEventEmail({
      event: {
        type: "disbursement",
        loan: baseLoan,
        detail: { amount: 25000, date: "2026-09-15", investorName: "Ada" },
        appUrl: "https://example.com",
      },
      recipient: recipient({
        preferences: {
          ...defaultEmailPreferences("user-1"),
          includeAmounts: false,
        },
      }),
    });

    expect(built.html).toContain("Hidden");
    expect(built.html).not.toContain("₱25,000");
  });

  it("renders a signing request with the sign CTA", () => {
    const built = renderEventEmail({
      event: {
        type: "loan_created",
        loan: baseLoan,
        appUrl: "https://example.com",
      },
      recipient: recipient(),
    });

    expect(built.subject).toBe("Kame Lends: Sign contract for Alpha Loan");
    expect(built.html).toContain("Your signature is needed");
    expect(built.html).toContain("Review and sign");
    expect(built.html).toContain("https://example.com/loans/42/sign");
    expect(built.html).toContain("https://example.com/loans/42");
    expect(built.html).toContain("maria@example.com");
  });

  it("puts the payment amount in the summary card", () => {
    const built = renderEventEmail({
      event: {
        type: "payment_received",
        loan: baseLoan,
        detail: {
          amount: 5000,
          date: "2026-09-20",
          investorName: "Ada",
        },
        appUrl: "https://example.com",
      },
      recipient: recipient(),
    });

    expect(built.subject).toBe("Kame Lends: Payment received for Alpha Loan");
    expect(built.html).toContain("Amount received");
    expect(built.html).toContain("₱5,000");
    expect(built.html).toContain("Sep 20, 2026");
    expect(built.html).toContain("Ada");
  });

  it("shows the previous and new interest due dates", () => {
    const built = renderEventEmail({
      event: {
        type: "interest_extended",
        loan: baseLoan,
        detail: {
          date: "2026-10-15",
          previousDate: "2026-10-01",
        },
        appUrl: "https://example.com",
      },
      recipient: recipient(),
    });

    expect(built.subject).toBe(
      "Kame Lends: New interest due date for Alpha Loan",
    );
    expect(built.html).toContain("moved from Oct 1, 2026 to Oct 15, 2026");
    expect(built.html).toContain("Previous due date Oct 1, 2026");
  });

  it("shows the remaining signature count after a signature", () => {
    const built = renderEventEmail({
      event: {
        type: "contract_signed",
        loan: baseLoan,
        detail: {
          partyName: "Ada",
          partyRole: "Investor",
          signedCount: 1,
          signerTotal: 3,
        },
        appUrl: "https://example.com",
      },
      recipient: recipient(),
    });

    expect(built.subject).toBe("Kame Lends: Ada signed Alpha Loan");
    expect(built.html).toContain(
      "<strong>2</strong> signatures are still needed.",
    );
    expect(built.html).toContain("https://example.com/loans/42?signing=1");
  });

  it("renders group context for an added loan", () => {
    const built = renderEventEmail({
      event: {
        type: "loan_added",
        loan: baseLoan,
        group: { id: 9, name: "Cebu Group" },
        appUrl: "https://example.com",
      },
      recipient: recipient(),
    });

    expect(built.subject).toBe(
      "Kame Lends: Alpha Loan was added to Cebu Group",
    );
    expect(built.html).toContain("https://example.com/groups/9");
  });
});

describe("renderReminderDigest", () => {
  it("combines signatures and due sections", () => {
    const built = renderReminderDigest({
      recipient: recipient(),
      sections: {
        signatures: [
          {
            loanId: 42,
            loanName: "Alpha Loan",
            dueDateKey: "2026-10-01",
            totalAmount: 0,
            kind: "signature",
            signingUrl: "https://example.com/loans/42/sign",
          },
        ],
        upcoming: [
          {
            loanId: 43,
            loanName: "Beta Loan",
            dueDateKey: "2026-10-03",
            totalAmount: 50000,
            kind: "upcoming",
            daysUntil: 3,
          },
        ],
        dueToday: [],
        overdue: [],
      },
      appUrl: "https://example.com",
    });

    expect(built.subject).toBe("Kame Lends: 2 items need your attention");
    expect(built.html).toContain("Contracts waiting for your signature");
    expect(built.html).toContain("Due soon");
    expect(built.html).toContain("signature needed");
    expect(built.html).toContain("in 3 days");
    expect(built.html).toContain("₱50,000");
    expect(built.html).toContain("Review and sign");
    expect(built.html).toContain("https://example.com/loans/42/sign");
    expect(built.html).toContain("https://example.com/loans/43");
  });

  it("uses a signature-only subject when no due items exist", () => {
    const built = renderReminderDigest({
      recipient: recipient(),
      sections: {
        signatures: [
          {
            loanId: 42,
            loanName: "Alpha Loan",
            dueDateKey: "2026-10-01",
            totalAmount: 0,
            kind: "signature",
          },
        ],
        upcoming: [],
        dueToday: [],
        overdue: [],
      },
      appUrl: "https://example.com",
    });

    expect(built.subject).toBe("Kame Lends: 1 contract to sign");
  });
});
