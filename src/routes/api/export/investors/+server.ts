import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import {
  investorsPdfFilename,
  pdfResponse,
  renderInvestorsPdfBuffer,
} from "$lib/server/pdf/render";
import type { InvestorWithLoans } from "$lib/types";

export const POST: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await event.request.json();
    const data = body.data as InvestorWithLoans[];
    const enabledSectionKeys = body.enabledSectionKeys as string[];

    if (!Array.isArray(data) || !Array.isArray(enabledSectionKeys)) {
      return new Response("Invalid request", { status: 400 });
    }

    const buffer = await renderInvestorsPdfBuffer(data, enabledSectionKeys);
    return pdfResponse(buffer, investorsPdfFilename());
  } catch (error) {
    console.error("Investors PDF export error:", error);
    return new Response("Failed to generate PDF", { status: 500 });
  }
};
