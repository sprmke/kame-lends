import { normalizeEmail } from "$lib/loan-signing";

export type EmailPartyRole = "owner" | "borrower" | "investor" | "witness";

export type EmailRecipientSeed = {
  email: string;
  userId: string | null;
  name: string;
  roles: EmailPartyRole[];
};

export type LoanEmailRecipient = EmailRecipientSeed & {
  roleLabels: string[];
};

export const EMAIL_ROLE_LABELS: Record<EmailPartyRole, string> = {
  owner: "Owner",
  borrower: "Borrower",
  investor: "Investor",
  witness: "Witness",
};

export function roleLabel(role: EmailPartyRole): string {
  return EMAIL_ROLE_LABELS[role];
}

export function mergeEmailRecipients(
  ...lists: EmailRecipientSeed[][]
): EmailRecipientSeed[] {
  const byEmail = new Map<string, EmailRecipientSeed>();

  for (const list of lists) {
    for (const recipient of list) {
      const email = normalizeEmail(recipient.email);
      if (!email) continue;

      const existing = byEmail.get(email);
      if (!existing) {
        byEmail.set(email, {
          email,
          userId: recipient.userId,
          name: recipient.name.trim(),
          roles: [...new Set(recipient.roles)],
        });
        continue;
      }

      if (!existing.userId && recipient.userId)
        existing.userId = recipient.userId;
      if (!existing.name.trim() && recipient.name.trim()) {
        existing.name = recipient.name.trim();
      }
      for (const role of recipient.roles) {
        if (!existing.roles.includes(role)) existing.roles.push(role);
      }
    }
  }

  return [...byEmail.values()];
}

export function excludeActorRecipients(
  recipients: EmailRecipientSeed[],
  actor: { actorUserId?: string | null; actorEmail?: string | null },
): EmailRecipientSeed[] {
  const actorEmail = normalizeEmail(actor.actorEmail);
  return recipients.filter((recipient) => {
    if (actor.actorUserId && recipient.userId === actor.actorUserId)
      return false;
    if (actorEmail && normalizeEmail(recipient.email) === actorEmail)
      return false;
    return true;
  });
}

export function filterRecipientsByRole<T extends EmailRecipientSeed>(
  recipients: T[],
  allowed: EmailPartyRole[],
): T[] {
  const set = new Set(allowed);
  return recipients.filter((recipient) =>
    recipient.roles.some((role) => set.has(role)),
  );
}

export function withRoleLabels(
  recipients: EmailRecipientSeed[],
): LoanEmailRecipient[] {
  return recipients.map((recipient) => ({
    ...recipient,
    roleLabels: recipient.roles.map(roleLabel),
  }));
}
