import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { paymentMethods } from "$lib/server/db/schema";
import { getSession } from "$lib/server/session";
import {
  listPaymentMethodsForUser,
  parsePaymentMethodInput,
  toPublicPaymentMethod,
} from "$lib/server/payment-methods";

export const GET: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
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

    const body = await event.request.json();
    const parsed = parsePaymentMethodInput(body);
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
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
