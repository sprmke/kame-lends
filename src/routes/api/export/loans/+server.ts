import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/session';
import { loansPdfFilename, pdfResponse, renderLoansPdfBuffer } from '$lib/server/pdf/render';
import type { LoanWithInvestors } from '$lib/types';

export const POST: RequestHandler = async (event) => {
	const session = await getSession(event);
	if (!session?.user?.id) {
		return new Response('Unauthorized', { status: 401 });
	}

	try {
		const body = await event.request.json();
		const data = body.data as LoanWithInvestors[];
		const enabledSectionKeys = body.enabledSectionKeys as string[];
		const investorId = body.investorId as number | undefined;

		if (!Array.isArray(data) || !Array.isArray(enabledSectionKeys)) {
			return new Response('Invalid request', { status: 400 });
		}

		const buffer = await renderLoansPdfBuffer(data, enabledSectionKeys, investorId);
		return pdfResponse(buffer, loansPdfFilename());
	} catch (error) {
		console.error('Loans PDF export error:', error);
		return new Response('Failed to generate PDF', { status: 500 });
	}
};
