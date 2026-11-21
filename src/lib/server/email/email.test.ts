import { describe, expect, it } from "vitest";
import {
  buildEmailCtaHtml,
  renderBrandedEmailShell,
  resolveEmailLogoUrl,
} from "./branded-email-shell";
import { escapeHtml, replacePlaceholders } from "./email-html";
import { signingPartyRoleLabel } from "./loan-created-email";
import { buildBackupEmailHtml, buildBackupEmailSubject } from "./backup-email";

describe("email-html", () => {
  it("escapes HTML entities", () => {
    expect(escapeHtml(`<a href="x">O'Brien & Co</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;O&#039;Brien &amp; Co&lt;/a&gt;",
    );
  });

  it("replaces placeholders", () => {
    expect(replacePlaceholders("Hi {{name}}", { name: "Ada" })).toBe("Hi Ada");
  });
});

describe("branded-email-shell", () => {
  it("builds a CTA with escaped URL and label", () => {
    const html = buildEmailCtaHtml(
      "Sign contract",
      "https://example.com/loans/1/sign",
    );
    expect(html).toContain('href="https://example.com/loans/1/sign"');
    expect(html).toContain("Sign contract");
    expect(html).toContain("#fb9f44");
  });

  it("renders shell with Kame Lends branding", () => {
    const html = renderBrandedEmailShell({
      emailTitle: "Contract ready to sign",
      unitLabel: "Lot Title Loan",
      bodyHtml: "<p>Body</p>",
      logoUrl: "https://example.com/brand/kame-lends-icon-1024.png",
    });
    expect(html).toContain("Kame Lends");
    expect(html).toContain("Contract ready to sign");
    expect(html).toContain("Lot Title Loan");
    expect(html).toContain(
      "https://example.com/brand/kame-lends-icon-1024.png",
    );
    expect(html).toContain("<p>Body</p>");
    expect(html).not.toContain("{{emailTitle}}");
  });

  it("resolves logo from app origin", () => {
    expect(resolveEmailLogoUrl("https://pawn-tracker.vercel.app")).toBe(
      "https://pawn-tracker.vercel.app/brand/kame-lends-icon-1024.png",
    );
  });
});

describe("loan-created-email", () => {
  it("labels signing roles", () => {
    expect(signingPartyRoleLabel("borrower")).toBe("Borrower");
    expect(signingPartyRoleLabel("lender")).toBe("Investor");
    expect(signingPartyRoleLabel("witness_1")).toBe("Witness");
  });
});

describe("backup-email", () => {
  it("renders branded backup summary", () => {
    const html = buildBackupEmailHtml({
      totalInvestors: 2,
      totalLoans: 5,
      activeLoans: 3,
      completedLoans: 1,
      overdueLoans: 1,
      totalTransactions: 10,
      totalLoanInvestors: 4,
      totalInterestPeriods: 2,
      totalReceivedPayments: 6,
    });

    expect(html).toContain("Daily backup");
    expect(html).toContain("Kame Lends");
    expect(html).toContain(">5<");
    expect(buildBackupEmailSubject(new Date("2026-09-17T00:00:00Z"))).toContain(
      "Kame Lends daily backup",
    );
  });
});
