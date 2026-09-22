import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { MAX_PDF_EXPORT_ROWS } from "$lib/server/pdf/export-limits";
import {
  loansPdfFilename,
  pdfResponse,
  renderLoansPdfBuffer,
} from "$lib/server/pdf/render";
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
    const data = body.data as LoanWithInvestors[];
    const enabledSectionKeys = body.enabledSectionKeys as string[];
    const investorId = body.investorId as number | undefined;

    if (!Array.isArray(data) || !Array.isArray(enabledSectionKeys)) {
      return json({ error: "Invalid request" }, { status: 400 });
    }
    if (data.length > MAX_PDF_EXPORT_ROWS) {
      return json(
        {
          error: `Too many rows for a single export (max ${MAX_PDF_EXPORT_ROWS}). Narrow the filters first.`,
        },
        { status: 413 },
      );
    }

    const buffer = await renderLoansPdfBuffer(
      data,
      enabledSectionKeys,
      investorId,
    );
    return pdfResponse(buffer, loansPdfFilename());
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : String(error ?? "unknown");
    console.error("Loans PDF export error:", detail, error);
    return json({ error: "Failed to generate PDF", detail }, { status: 500 });
  }
};
