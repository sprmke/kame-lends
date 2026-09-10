import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { paymentMethods } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";
import { isPartyUserLinkedToWorkspace } from "$lib/server/party-profile";
import {
  MAX_PAYMENT_METHODS_PER_USER,
  countPaymentMethodsForUser,
  listPaymentMethodsForUser,
  parsePaymentMethodInput,
  readJsonBody,
  toPublicPaymentMethod,
} from "$lib/server/payment-methods";

async function assertCanManagePartyUserPayments(
  adminUserId: string,
  partyUserId: string,
) {
  if (!(await isWorkspaceAdmin(adminUserId))) {
    return json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isPartyUserLinkedToWorkspace(adminUserId, partyUserId))) {
    return json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const partyUserId = event.params.userId;
    const denied = await assertCanManagePartyUserPayments(
      session.user.id,
      partyUserId,
    );
    if (denied) return denied;

    const methods = await listPaymentMethodsForUser(partyUserId);
    return json(methods);
  } catch (error) {
    console.error("Error fetching party payment methods:", error);
    return json({ error: "Failed to fetch payment methods" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const partyUserId = event.params.userId;
    const denied = await assertCanManagePartyUserPayments(
      session.user.id,
      partyUserId,
    );
    if (denied) return denied;

    const bodyResult = await readJsonBody(event.request);
    if (!bodyResult.ok) {
      return json({ error: bodyResult.error }, { status: 400 });
    }

    const parsed = parsePaymentMethodInput(
      (bodyResult.data && typeof bodyResult.data === "object"
        ? bodyResult.data
        : {}) as Record<string, unknown>,
    );
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }

    const existingCount = await countPaymentMethodsForUser(partyUserId);
    if (existingCount >= MAX_PAYMENT_METHODS_PER_USER) {
      return json(
        { error: `Limit is ${MAX_PAYMENT_METHODS_PER_USER} payment methods` },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(paymentMethods)
      .values({
        userId: partyUserId,
        bankName: parsed.bankName,
        accountNumber: parsed.accountNumber,
        qrCodeUrl: parsed.qrCodeUrl,
      })
      .returning();

    return json(toPublicPaymentMethod(created), { status: 201 });
  } catch (error) {
    console.error("Error creating party payment method:", error);
    return json({ error: "Failed to create payment method" }, { status: 500 });
  }
};
