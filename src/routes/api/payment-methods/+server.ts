import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { paymentMethods } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import {
  MAX_PAYMENT_METHODS_PER_USER,
  canManagePaymentMethods,
  countPaymentMethodsForUser,
  listPaymentMethodsForUser,
  parsePaymentMethodInput,
  readJsonBody,
  toPublicPaymentMethod,
} from "$lib/server/payment-methods";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canManagePaymentMethods(session.user.id))) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const methods = await listPaymentMethodsForUser(session.user.id);
    return json(methods);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return json({ error: "Failed to fetch payment methods" }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canManagePaymentMethods(session.user.id))) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

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

    const existingCount = await countPaymentMethodsForUser(session.user.id);
    if (existingCount >= MAX_PAYMENT_METHODS_PER_USER) {
      return json(
        { error: `Limit is ${MAX_PAYMENT_METHODS_PER_USER} payment methods` },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(paymentMethods)
      .values({
        userId: session.user.id,
        bankName: parsed.bankName,
        accountNumber: parsed.accountNumber,
        qrCodeUrl: parsed.qrCodeUrl,
      })
      .returning();

    return json(toPublicPaymentMethod(created), { status: 201 });
  } catch (error) {
    console.error("Error creating payment method:", error);
    return json({ error: "Failed to create payment method" }, { status: 500 });
  }
};
