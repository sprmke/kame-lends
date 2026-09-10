import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { investors, users } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import {
  normalizeValidIdUrl,
  normalizeSignatureImageUrl,
} from "$lib/valid-id-document";
import { invalidateInvestorData } from "$lib/server/cache-invalidation";
import { findOrCreatePartyUser } from "$lib/server/party-user";
import { hasInvestorContactViewAccess } from "$lib/server/access-control";

export const GET: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const investorId = parseInt(id);

    if (!(await hasInvestorContactViewAccess(investorId, session.user.id))) {
      return json({ error: "Investor not found" }, { status: 404 });
    }

    const investor = await db.query.investors.findFirst({
      where: eq(investors.id, investorId),
      with: {
        loanInvestors: {
          with: {
            loan: true,
          },
        },
        transactions: {
          orderBy: (transactions, { desc }) => [desc(transactions.date)],
        },
      },
    });

    if (!investor) {
      return json({ error: "Investor not found" }, { status: 404 });
    }

    return json(investor);
  } catch (error) {
    console.error("Error fetching investor:", error);
    return json({ error: "Failed to fetch investor" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const investorId = parseInt(id);
    const body = await request.json();

    // Verify ownership
    const existingInvestor = await db.query.investors.findFirst({
      where: and(
        eq(investors.id, investorId),
        eq(investors.userId, session.user.id),
      ),
    });

    if (!existingInvestor) {
      return json({ error: "Investor not found" }, { status: 404 });
    }

    const partyUser = await findOrCreatePartyUser({
      email: body.email,
      name: body.name,
      role: "investor",
    });
    const investorUserId = partyUser?.id ?? existingInvestor.investorUserId;

    const updatedInvestor = await db
      .update(investors)
      .set({
        name: body.name,
        email: body.email,
        contactNumber: body.contactNumber || null,
        address: body.address || null,
        validIdUrl: normalizeValidIdUrl(body.validIdUrl),
        eSignatureUrl: normalizeSignatureImageUrl(body.eSignatureUrl),
        investorUserId: investorUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(investors.id, investorId),
          eq(investors.userId, session.user.id),
        ),
      )
      .returning();

    invalidateInvestorData();
    return json(updatedInvestor[0]);
  } catch (error) {
    console.error("Error updating investor:", error);
    return json({ error: "Failed to update investor" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const investorId = parseInt(id);

    // Check if investor has any loans or transactions and verify ownership
    const investor = await db.query.investors.findFirst({
      where: and(
        eq(investors.id, investorId),
        eq(investors.userId, session.user.id),
      ),
      with: {
        loanInvestors: true,
        transactions: true,
        debts: true,
      },
    });

    if (!investor) {
      return json({ error: "Investor not found" }, { status: 404 });
    }

    const debtCount = investor.debts?.length ?? 0;
    if (
      investor.loanInvestors.length > 0 ||
      investor.transactions.length > 0 ||
      debtCount > 0
    ) {
      return json(
        {
          error:
            "Cannot delete investor with existing loans, transactions, or borrowings",
          details: `This investor has ${investor.loanInvestors.length} loan(s), ${investor.transactions.length} transaction(s), and ${debtCount} borrowing(s)`,
        },
        { status: 400 },
      );
    }

    // Delete investor
    await db
      .delete(investors)
      .where(
        and(
          eq(investors.id, investorId),
          eq(investors.userId, session.user.id),
        ),
      );

    invalidateInvestorData();
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting investor:", error);
    return json({ error: "Failed to delete investor" }, { status: 500 });
  }
};
