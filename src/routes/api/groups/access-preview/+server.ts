import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { previewAccessForLoanIds } from "$lib/server/group-access";
import { accessPreviewBodySchema, parseJsonBody } from "$lib/group-validation";

/** Wizard dry-run before the group exists. */
export const POST: RequestHandler = async (event) => {
  try {
    const session = await getSession(event);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = parseJsonBody(
      accessPreviewBodySchema,
      await event.request.json(),
    );
    if ("error" in parsed) {
      return json({ error: parsed.error }, { status: 400 });
    }

    const loanIds =
      parsed.data.loanIds.length > 0
        ? parsed.data.loanIds
        : parsed.data.addLoanIds;

    const result = await previewAccessForLoanIds({
      existingLoanIds: [],
      addLoanIds: loanIds,
    });

    return json({
      gained: result.gained,
      lost: result.lost,
      unchanged: result.unchanged,
      mixedBorrowers: result.mixedBorrowerCount >= 2,
      mixedBorrowerCount: result.mixedBorrowerCount,
      loanCount: result.resultingLoanIds.length,
      peopleCount: result.gained.length,
    });
  } catch (error) {
    console.error("Error previewing wizard access:", error);
    return json({ error: "Failed to preview access" }, { status: 500 });
  }
};
