import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  hasGroupManageAccess,
  getGroupLoanIds,
  previewAccessForLoanIds,
} from "$lib/server/group-access";
import { accessPreviewBodySchema, parseJsonBody } from "$lib/group-validation";
import { parseIdParam } from "$lib/server/route-params";

export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = parseIdParam(event.params.id);

    if (groupId === null) {
      return json({ error: "Invalid id" }, { status: 400 });
    }
    if (!(await hasGroupManageAccess(groupId, session.user.id))) {
      return json({ error: "Group not found" }, { status: 404 });
    }

    const parsed = parseJsonBody(
      accessPreviewBodySchema,
      await event.request.json(),
    );
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }

    const existingLoanIds = await getGroupLoanIds(groupId);
    const result = await previewAccessForLoanIds({
      existingLoanIds,
      addLoanIds: parsed.data.addLoanIds,
      removeLoanIds: parsed.data.removeLoanIds,
    });

    return json({
      gained: result.gained,
      lost: result.lost,
      unchanged: result.unchanged,
      mixedBorrowers: result.mixedBorrowerCount >= 2,
      mixedBorrowerCount: result.mixedBorrowerCount,
      loanCount: result.resultingLoanIds.length,
      peopleCount: result.unchanged + result.gained.length,
    });
  } catch (error) {
    console.error("Error previewing access:", error);
    return json({ error: "Failed to preview access" }, { status: 500 });
  }
};
