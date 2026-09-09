import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { getSession } from '$lib/server/session';
import { db } from '$lib/server/db';
import { loans } from '$lib/server/db/schema';
import type { ContractCustomization } from '$lib/loan-contract-customization';
import {
	applyContractCustomization,
	buildDefaultContractCustomizationFromLoan
} from '$lib/loan-contract-customization';
import { buildLoanContractData } from '$lib/loan-contract-data';
import {
	applySigningSignatures,
	buildInvestorEmailMap,
	type SigningInvitationRecord
} from '$lib/loan-signing';
import {
	loanContractPdfFilename,
	pdfResponse,
	renderLoanContractPdfBuffer
} from '$lib/server/pdf/render';

interface RouteParams {
	params: Promise<{ id: string }>;
}

export const GET: RequestHandler = async (event) => {
	const { params, request } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = params;
		const loanId = Number(id);
		if (Number.isNaN(loanId)) {
			return json({ error: 'Invalid loan ID' }, { status: 400 });
		}

		const loan = await db.query.loans.findFirst({
			where: eq(loans.id, loanId),
			with: {
				borrower: true,
				loanContract: true,
				signingInvitations: true,
				loanInvestors: {
					with: {
						investor: true,
						interestPeriods: true,
						receivedPayments: true
					}
				}
			}
		});

		if (!loan || loan.userId !== session.user.id) {
			return json({ error: 'Loan not found' }, { status: 404 });
		}

		const baseData = buildLoanContractData(loan);
		const storedCustomization = loan.loanContract?.customization as
			ContractCustomization | undefined;
		const customization =
			storedCustomization ?? buildDefaultContractCustomizationFromLoan(baseData);
		const appliedData = applyContractCustomization(baseData, customization);
		const investorEmailById = buildInvestorEmailMap(loan);
		const merged = applySigningSignatures(
			appliedData,
			customization,
			(loan.signingInvitations ?? []) as SigningInvitationRecord[],
			investorEmailById
		);

		return json({
			contractData: merged.data,
			customization: merged.customization,
			hasStoredContract: Boolean(loan.loanContract)
		});
	} catch (error) {
		console.error('Error fetching loan contract:', error);
		return json({ error: 'Failed to fetch loan contract' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	const { params } = event;
	try {
		const session = await getSession(event);
		if (!session?.user?.id) {
			return new Response('Unauthorized', { status: 401 });
		}

		const loanId = Number(params.id);
		if (Number.isNaN(loanId)) {
			return new Response('Invalid loan ID', { status: 400 });
		}

		const loan = await db.query.loans.findFirst({
			where: eq(loans.id, loanId),
			with: {
				borrower: true,
				loanContract: true,
				signingInvitations: true,
				loanInvestors: {
					with: {
						investor: true,
						interestPeriods: true,
						receivedPayments: true
					}
				}
			}
		});

		if (!loan || loan.userId !== session.user.id) {
			return new Response('Loan not found', { status: 404 });
		}

		const baseData = buildLoanContractData(loan);
		const storedCustomization = loan.loanContract?.customization as
			ContractCustomization | undefined;
		const customization =
			storedCustomization ?? buildDefaultContractCustomizationFromLoan(baseData);
		const appliedData = applyContractCustomization(baseData, customization);
		const investorEmailById = buildInvestorEmailMap(loan);
		const merged = applySigningSignatures(
			appliedData,
			customization,
			(loan.signingInvitations ?? []) as SigningInvitationRecord[],
			investorEmailById
		);

		const buffer = await renderLoanContractPdfBuffer(loan, merged.customization, merged.data);
		return pdfResponse(buffer, loanContractPdfFilename(loan));
	} catch (error) {
		console.error('Error generating loan contract PDF:', error);
		return new Response('Failed to generate contract PDF', { status: 500 });
	}
};
