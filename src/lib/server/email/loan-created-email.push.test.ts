import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendLoanCreatedSigningEmails } from "$lib/server/email/loan-created-email";

const sendSigningPushForEmails = vi.fn().mockResolvedValue(1);

vi.mock("$lib/server/push/signing", () => ({
  sendSigningPushForEmails,
}));

vi.mock("$lib/server/email/send-email", () => ({
  isTransactionalEmailConfigured: vi.fn().mockReturnValue(false),
  sendTransactionalEmail: vi.fn(),
}));

describe("sendLoanCreatedSigningEmails push fanout", () => {
  beforeEach(() => {
    sendSigningPushForEmails.mockClear();
  });

  it("sends signing push even when transactional email is disabled", async () => {
    await sendLoanCreatedSigningEmails({
      loanId: 42,
      loanName: "Unit 12",
      recipients: [
        {
          partyRole: "borrower",
          partyName: "Ada",
          partyEmail: "ada@example.com",
        },
      ],
    });

    expect(sendSigningPushForEmails).toHaveBeenCalledWith({
      loanId: 42,
      loanName: "Unit 12",
      emails: ["ada@example.com"],
    });
  });
});
