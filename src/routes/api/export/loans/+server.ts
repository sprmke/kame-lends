import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { getCachedLoans } from "$lib/server/cached-data";
import { MAX_PDF_EXPORT_ROWS } from "$lib/server/pdf/export-limits";
import {
  loansPdfFilename,
  pdfResponse,
  renderLoansPdfBuffer,
} from "$lib/server/pdf/render";
import {
  parseEnabledSectionKeys,
  requestedExportIds,
  selectOwnedExportRows,
} from "$lib/server/export-owned";
import { publicJsonError } from "$lib/server/http-error";
import type { LoanWithInvestors } from "$lib/types";

/** Isolated from the main app bundle: heavy @react-pdf/renderer + react deps, longer timeout for large exports. */
export const config = {
  maxDuration: 60,
  memory: 1024,
  split: true,
};

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const enabledSectionKeys = parseEnabledSectionKeys(body);
    if (!enabledSectionKeys) {
      return json({ error: "Invalid request" }, { status: 400 });
    }

    const owned = (await getCachedLoans(
      session.user.id,
      "list",
    )) as LoanWithInvestors[];
    const data = selectOwnedExportRows(owned, requestedExportIds(body));
    if (data.length > MAX_PDF_EXPORT_ROWS) {
      return json(
        {
          error: `Too many rows for a single export (max ${MAX_PDF_EXPORT_ROWS}). Narrow the filters first.`,
        },
        { status: 413 },
      );
    }

    const investorId =
      body && typeof body === "object" && "investorId" in body
        ? Number((body as { investorId?: unknown }).investorId)
        : undefined;

    const buffer = await renderLoansPdfBuffer(
      data,
      enabledSectionKeys,
      Number.isFinite(investorId) ? investorId : undefined,
    );
    return pdfResponse(buffer, loansPdfFilename());
  } catch (error) {
    console.error("Loans PDF export error:", error);
    return json(publicJsonError("Failed to generate PDF", error), {
      status: 500,
    });
  }
};
