import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { loadLoanDetail } from "$lib/server/loan-detail";
import { resolveCanSignContract } from "$lib/server/loan-signing-server";
import { requireUserSession } from "$lib/server/request-auth";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const id = Number(event.params.id);
  if (Number.isNaN(id)) throw error(400, "Invalid id");
  const result = await loadLoanDetail(id, session.user.id, {
    includeContract: event.url.searchParams.get("edit") === "1",
  });
  if (!result) throw error(404, "Not found");

  if (
    event.url.searchParams.get("edit") === "1" &&
    !result.access.canAdminEdit
  ) {
    throw error(403, "Read only");
  }

  const canSignContract = await resolveCanSignContract({
    loanId: id,
    userId: session.user.id,
    sessionEmail: session.user.email,
  });

  const { access, paymentMethods, ...entity } = result;
  return {
    entity,
    access,
    paymentMethods: paymentMethods ?? [],
    canSignContract,
  };
};
