import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { getCachedTransactions } from "$lib/server/cached-data";
import { MAX_PDF_EXPORT_ROWS } from "$lib/server/pdf/export-limits";
import {
  pdfResponse,
  renderTransactionsPdfBuffer,
  transactionsPdfFilename,
} from "$lib/server/pdf/render";
import {
  parseEnabledSectionKeys,
  requestedExportIds,
  selectOwnedExportRows,
} from "$lib/server/export-owned";
import { publicJsonError } from "$lib/server/http-error";
import type { TransactionWithInvestor } from "$lib/types";

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

    const owned = (await getCachedTransactions(
      session.user.id,
      null,
    )) as TransactionWithInvestor[];
    const data = selectOwnedExportRows(owned, requestedExportIds(body));
    if (data.length > MAX_PDF_EXPORT_ROWS) {
      return json(
        {
          error: `Too many rows for a single export (max ${MAX_PDF_EXPORT_ROWS}). Narrow the filters first.`,
        },
        { status: 413 },
      );
    }

    const buffer = await renderTransactionsPdfBuffer(data, enabledSectionKeys);
    return pdfResponse(buffer, transactionsPdfFilename());
  } catch (error) {
    console.error("Transactions PDF export error:", error);
    return json(publicJsonError("Failed to generate PDF", error), {
      status: 500,
    });
  }
};
