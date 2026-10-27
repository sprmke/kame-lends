import type { RequestEvent } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { telegramSigningRoleLabel } from "$lib/groups/telegram-message-context";
import { db } from "$lib/server/db";
import { loanSigningInvitations, loans } from "$lib/server/db/schema";
import { scheduleDrain } from "$lib/server/jobs/after-response";
import { enqueueGroupLoanChanged } from "$lib/server/jobs/queue";

/** Manual contract signature only. Auto-sign does not call this. */
export async function enqueueContractSigned(
  event: RequestEvent,
  input: {
    loanId: number;
    invitationId: number;
    partyName: string;
    partyRole: string;
  },
): Promise<void> {
  const [loan, invitations] = await Promise.all([
    db.query.loans.findFirst({
      where: eq(loans.id, input.loanId),
      columns: { loanName: true },
    }),
    db
      .select({ signedAt: loanSigningInvitations.signedAt })
      .from(loanSigningInvitations)
      .where(eq(loanSigningInvitations.loanId, input.loanId)),
  ]);

  const signerRole = telegramSigningRoleLabel(input.partyRole);
  const signerName = input.partyName.trim() || signerRole;
  const loanName = loan?.loanName?.trim() || "Loan";
  const signedCount = invitations.filter((row) => row.signedAt != null).length;
  const signerTotal = invitations.length;

  await enqueueGroupLoanChanged(input.loanId, {
    activity: {
      type: "contract_signed",
      entityId: input.invitationId,
      summary: `${signerName} signed ${loanName}`,
      detail: {
        signerName,
        signerRole,
        signedCount,
        signerTotal,
      },
    },
  });
  scheduleDrain(event);
}
