import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { paymentMethods } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import {
  parsePaymentMethodInput,
  toPublicPaymentMethod,
} from "$lib/server/payment-methods";

export const PUT: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(event.params.id);
    if (!Number.isFinite(id)) {
      return json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await event.request.json();
    const parsed = parsePaymentMethodInput(body);
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }

    const [updated] = await db
      .update(paymentMethods)
      .set({
        bankName: parsed.bankName,
        accountNumber: parsed.accountNumber,
        qrCodeUrl: parsed.qrCodeUrl,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentMethods.id, id),
          eq(paymentMethods.userId, session.user.id),
        ),
      )
      .returning();

    if (!updated) {
      return json({ error: "Not found" }, { status: 404 });
    }

    return json(toPublicPaymentMethod(updated));
  } catch (error) {
    console.error("Error updating payment method:", error);
    return json({ error: "Failed to update payment method" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(event.params.id);
    if (!Number.isFinite(id)) {
      return json({ error: "Invalid id" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, id),
          eq(paymentMethods.userId, session.user.id),
        ),
      )
      .returning({ id: paymentMethods.id });

    if (!deleted) {
      return json({ error: "Not found" }, { status: 404 });
    }

    return json({ success: true });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return json({ error: "Failed to delete payment method" }, { status: 500 });
  }
};
