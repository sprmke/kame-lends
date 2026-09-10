import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { investors, loans } from "$lib/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireUserSession } from "$lib/server/request-auth";
import { hasInvestorContactViewAccess } from "$lib/server/access-control";
import { isWorkspaceAdmin } from "$lib/server/workspace-admin";

async function fetchOne(id: number) {
  return db.query.investors.findFirst({
    where: eq(investors.id, id),
    with: {
      loanInvestors: {
        with: {
          loan: true,
          interestPeriods: true,
        },
      },
      transactions: {
        orderBy: (transactions, { desc }) => [desc(transactions.date)],
      },
      debts: {
        orderBy: (debts, { desc }) => [desc(debts.date)],
        with: {
          interestPeriods: {
            with: { receivedPayments: true },
            orderBy: (periods, { asc }) => [asc(periods.periodNumber)],
          },
        },
      },
    },
  });
}

async function fetchInvestorLoans(loanIds: number[]) {
  if (loanIds.length === 0) return [];
  return db.query.loans.findMany({
    where: inArray(loans.id, loanIds),
    with: {
      borrower: true,
      loanInvestors: {
        with: {
          investor: true,
          interestPeriods: true,
          receivedPayments: true,
        },
      },
    },
  });
}

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const id = Number(event.params.id);
  if (Number.isNaN(id)) throw error(400, "Invalid id");

  const entity = await fetchOne(id);
  if (!entity || !(await hasInvestorContactViewAccess(id, session.user.id))) {
    throw error(404, "Not found");
  }

  const canManage =
    entity.userId === session.user.id &&
    (await isWorkspaceAdmin(session.user.id));

  if (event.url.searchParams.get("edit") === "1" && !canManage) {
    throw error(403, "Read only");
  }

  const investorLoanIds = [
    ...new Set(entity.loanInvestors.map((li) => li.loanId)),
  ];
  const loans = await fetchInvestorLoans(investorLoanIds);

  return { entity, loans, canManage };
};
