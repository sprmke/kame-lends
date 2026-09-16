import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  getUserCommissionForLoan,
  hasMyCommissionAccess,
  upsertUserCommission,
} from "$lib/server/loan-user-commission";
import { invalidateLoanData } from "$lib/server/cache-invalidation";
import type { InterestType } from "$lib/types";

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const loanId = Number.parseInt(event.params.id, 10);
  if (!Number.isFinite(loanId)) {
    return json({ error: "Invalid loan ID." }, { status: 400 });
  }

  const allowed = await hasMyCommissionAccess(loanId, session.user.id);
  if (!allowed) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const commission = await getUserCommissionForLoan(loanId, session.user.id);
  return json({ commission });
};

export const PATCH: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const loanId = Number.parseInt(event.params.id, 10);
  if (!Number.isFinite(loanId)) {
    return json({ error: "Invalid loan ID." }, { status: 400 });
  }

  const allowed = await hasMyCommissionAccess(loanId, session.user.id);
  if (!allowed) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await event.request.json();
  const profitType: InterestType =
    body.profitType === "fixed" ? "fixed" : "rate";
  const profitValue = Number.parseFloat(String(body.profitValue));

  if (!Number.isFinite(profitValue) || profitValue < 0) {
    return json(
      { error: "Enter a commission amount of zero or more." },
      { status: 400 },
    );
  }

  const commission = await upsertUserCommission(loanId, session.user.id, {
    profitType,
    profitValue: String(profitValue),
  });

  invalidateLoanData();
  return json({ commission });
};
