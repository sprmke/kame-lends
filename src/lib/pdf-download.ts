import { downloadBlob } from '$lib/pdf-export';
import type { InvestorWithLoans, LoanWithInvestors, TransactionWithInvestor } from '$lib/types';

async function downloadPdfFromApi(
	endpoint: string,
	body: Record<string, unknown>,
	fallbackFilename: string
): Promise<void> {
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		throw new Error('Failed to generate PDF');
	}

	const blob = await response.blob();
	const disposition = response.headers.get('Content-Disposition');
	const match = disposition?.match(/filename="([^"]+)"/);
	const filename = match?.[1] ?? fallbackFilename;
	downloadBlob(blob, filename);
}

export async function downloadLoansPdf(
	data: LoanWithInvestors[],
	enabledSectionKeys: string[],
	investorId?: number
): Promise<void> {
	await downloadPdfFromApi(
		'/api/export/loans',
		{ data, enabledSectionKeys, investorId },
		'loans.pdf'
	);
}

export async function downloadInvestorsPdf(
	data: InvestorWithLoans[],
	enabledSectionKeys: string[]
): Promise<void> {
	await downloadPdfFromApi('/api/export/investors', { data, enabledSectionKeys }, 'investors.pdf');
}

export async function downloadTransactionsPdf(
	data: TransactionWithInvestor[],
	enabledSectionKeys: string[]
): Promise<void> {
	await downloadPdfFromApi(
		'/api/export/transactions',
		{ data, enabledSectionKeys },
		'transactions.pdf'
	);
}

export async function downloadLoanContractPdf(loanId: number): Promise<void> {
	const response = await fetch(`/api/loans/${loanId}/contract`, { method: 'POST' });
	if (!response.ok) {
		throw new Error('Failed to generate contract PDF');
	}
	const blob = await response.blob();
	const disposition = response.headers.get('Content-Disposition');
	const match = disposition?.match(/filename="([^"]+)"/);
	downloadBlob(blob, match?.[1] ?? `loan-contract-${loanId}.pdf`);
}
