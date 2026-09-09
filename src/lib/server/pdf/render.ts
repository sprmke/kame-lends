import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { LoansPDFDocument } from './loans-pdf-document';
import { InvestorsPDFDocument } from './investors-pdf-document';
import { TransactionsPDFDocument } from './transactions-pdf-document';
import { LoanContractPDFDocument } from './loan-contract-pdf-document';
import { formatDateForPDF } from '$lib/pdf-export';
import { buildLoanContractData, getLoanContractFilename } from '$lib/loan-contract-data';
import type { ContractCustomization } from '$lib/loan-contract-customization';
import type { LoanContractData } from '$lib/loan-contract-data';
import type { InvestorWithLoans, LoanWithInvestors, TransactionWithInvestor } from '$lib/types';

export async function renderLoansPdfBuffer(
	data: LoanWithInvestors[],
	enabledSectionKeys: string[],
	investorId?: number
): Promise<Uint8Array> {
	return renderToBuffer(
		React.createElement(LoansPDFDocument, {
			data,
			enabledSections: enabledSectionKeys,
			investorId
		}) as any
	);
}

export async function renderInvestorsPdfBuffer(
	data: InvestorWithLoans[],
	enabledSectionKeys: string[]
): Promise<Uint8Array> {
	return renderToBuffer(
		React.createElement(InvestorsPDFDocument, {
			data,
			enabledSections: enabledSectionKeys
		}) as any
	);
}

export async function renderTransactionsPdfBuffer(
	data: TransactionWithInvestor[],
	enabledSectionKeys: string[]
): Promise<Uint8Array> {
	return renderToBuffer(
		React.createElement(TransactionsPDFDocument, {
			data,
			enabledSections: enabledSectionKeys
		}) as any
	);
}

export async function renderLoanContractPdfBuffer(
	loan: LoanWithInvestors,
	customization?: ContractCustomization,
	contractDataOverride?: LoanContractData
): Promise<Uint8Array> {
	const contractData = contractDataOverride ?? buildLoanContractData(loan);
	return renderToBuffer(
		React.createElement(LoanContractPDFDocument, {
			data: contractData,
			customization
		}) as any
	);
}

export function pdfResponse(buffer: Uint8Array, filename: string): Response {
	return new Response(new Blob([new Uint8Array(buffer)]), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
}

export function loansPdfFilename(): string {
	const timestamp = formatDateForPDF(new Date()).replace(/\//g, '-');
	return `loans_${timestamp}.pdf`;
}

export function investorsPdfFilename(): string {
	const timestamp = formatDateForPDF(new Date()).replace(/\//g, '-');
	return `investors_${timestamp}.pdf`;
}

export function transactionsPdfFilename(): string {
	const timestamp = formatDateForPDF(new Date()).replace(/\//g, '-');
	return `transactions_${timestamp}.pdf`;
}

export function loanContractPdfFilename(loan: LoanWithInvestors): string {
	return getLoanContractFilename(loan);
}
