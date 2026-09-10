import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { loans } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "$lib/server/session";
import { hasLoanAdminAccess } from "$lib/server/access-control";
import { invalidateLoanData } from "$lib/server/cache-invalidation";

export const PATCH: RequestHandler = async (event) => {
  const { params, request } = event;
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const loanId = parseInt(id);
    const { status } = await request.json();

    if (!status) {
      return json({ error: "Status is required" }, { status: 400 });
    }

    const hasAccess = await hasLoanAdminAccess(loanId, session.user.id);
    if (!hasAccess) {
      return json({ error: "Loan not found" }, { status: 404 });
    }

    await db
      .update(loans)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(loans.id, loanId), eq(loans.userId, session.user.id)));

    const updatedLoan = await db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        loanInvestors: {
          with: {
            investor: true,
            interestPeriods: true,
            receivedPayments: true,
          },
        },
      },
    });

    invalidateLoanData();
    return json(updatedLoan);
  } catch (error) {
    console.error("Error updating loan status:", error);
    return json({ error: "Failed to update loan status" }, { status: 500 });
  }
};
