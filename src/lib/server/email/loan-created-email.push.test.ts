import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendLoanCreatedSigningEmails } from "$lib/server/email/loan-created-email";

const {
  sendSigningPushForEmails,
  sendNotificationEmail,
  getEmailPreferencesByEmails,
  isEmailNotificationsEnabled,
} = vi.hoisted(() => ({
  sendSigningPushForEmails: vi.fn().mockResolvedValue(1),
  sendNotificationEmail: vi.fn().mockResolvedValue({ status: "sent" }),
  getEmailPreferencesByEmails: vi.fn().mockResolvedValue(new Map()),
  isEmailNotificationsEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock("$lib/server/push/signing", () => ({
  sendSigningPushForEmails,
}));

vi.mock("$lib/server/email/index", () => ({
  isEmailNotificationsEnabled,
  sendNotificationEmail,
}));

vi.mock("$lib/server/email/preferences", () => ({
  getEmailPreferencesByEmails,
}));

describe("sendLoanCreatedSigningEmails", () => {
  beforeEach(() => {
    sendSigningPushForEmails.mockClear();
    sendNotificationEmail.mockClear();
    getEmailPreferencesByEmails.mockClear();
    isEmailNotificationsEnabled.mockReturnValue(false);
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
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("logs a signing request keyed by loan, invitation, and email", async () => {
    isEmailNotificationsEnabled.mockReturnValue(true);
    getEmailPreferencesByEmails.mockResolvedValue(
      new Map([
        [
          "ada@example.com",
          {
            userId: "user-1",
            emailEnabled: true,
            notifySigningRequests: true,
          },
        ],
      ]),
    );

    await sendLoanCreatedSigningEmails({
      loanId: 42,
      loanName: "Unit 12",
      recipients: [
        {
          partyRole: "borrower",
          partyName: "Ada",
          partyEmail: "Ada@Example.com",
          invitationId: 7,
        },
      ],
    });

    expect(sendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ada@example.com",
        userId: "user-1",
        fingerprint: "signing_request:42:7:ada@example.com",
        kind: "signing_request",
      }),
    );
  });

  it("skips a recipient who turned signing requests off", async () => {
    isEmailNotificationsEnabled.mockReturnValue(true);
    getEmailPreferencesByEmails.mockResolvedValue(
      new Map([
        [
          "ada@example.com",
          {
            userId: "user-1",
            emailEnabled: true,
            notifySigningRequests: false,
          },
        ],
      ]),
    );

    const result = await sendLoanCreatedSigningEmails({
      loanId: 42,
      loanName: "Unit 12",
      recipients: [
        {
          partyRole: "borrower",
          partyName: "Ada",
          partyEmail: "ada@example.com",
          invitationId: 7,
        },
      ],
    });

    expect(sendNotificationEmail).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });
});
