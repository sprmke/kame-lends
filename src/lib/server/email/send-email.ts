import { Resend } from "resend";
import { APP_NAME } from "$lib/brand";

let resendClient: Resend | null | undefined;

function getResendClient(): Resend | null {
  if (resendClient !== undefined) return resendClient;
  const key = process.env.RESEND_API_KEY?.trim();
  resendClient = key ? new Resend(key) : null;
  return resendClient;
}

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function resolveResendFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    `${APP_NAME} <onboarding@resend.dev>`
  );
}

export type SendTransactionalEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
};

/**
 * Send via Resend. Returns null when Resend is not configured (no-op).
 * Throws on API failure so callers can log without failing the parent action.
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<{ id: string | null } | null> {
  const client = getResendClient();
  if (!client) return null;

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const { data, error } = await client.emails.send({
    from: resolveResendFromAddress(),
    to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }

  return { id: data?.id ?? null };
}
