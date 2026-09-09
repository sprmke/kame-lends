import type { LoanStatus, Investor } from '$lib/types';
import type { LoanContractDraftInput } from '$lib/loan-contract-data';
import type {
	LoanFormTransaction,
	SelectedInvestorAllocation
} from '$lib/components/loans/loan-form-types';
import type { InvestorWithTransactions } from './investor-transactions-helpers';

export interface LoanPreviewItem {
	investor: Investor;
	sentDate: string;
	isPaid: boolean;
	capital: number;
	interest: number;
	interestRate: number;
	total: number;
}

export interface LoanFormSummary {
	totalCapital: number;
	totalInterest: number;
	totalAmount: number;
	totalReceived: number;
	totalBalance: number;
	averageRate: number;
	uniqueInvestors: number;
	status: LoanStatus;
	fundedCapital: number;
	balance: number;
}

export function getTotalPrincipal(selectedInvestors: SelectedInvestorAllocation[]): number {
	return selectedInvestors.reduce(
		(sum, si) => sum + si.transactions.reduce((inner, t) => inner + (parseFloat(t.amount) || 0), 0),
		0
	);
}

export function calculateLoanPreview(
	selectedInvestors: SelectedInvestorAllocation[]
): LoanPreviewItem[] {
	const result: LoanPreviewItem[] = [];
	const totalPrincipal = getTotalPrincipal(selectedInvestors);

	for (const si of selectedInvestors) {
		for (const transaction of si.transactions) {
			const capital = parseFloat(transaction.amount) || 0;
			let interest = 0;
			let interestRate = 0;

			if (si.hasMultipleInterest && si.interestPeriods.length > 0) {
				for (const period of si.interestPeriods) {
					if (period.interestType === 'rate') {
						const rate = parseFloat(period.interestRate) || 0;
						const baseAmount = capital === 0 ? totalPrincipal : capital;
						interest += baseAmount * (rate / 100);
					} else {
						interest += parseFloat(period.interestAmount) || 0;
					}
				}

				if (capital > 0) {
					interestRate = (interest / capital) * 100;
				} else if (totalPrincipal > 0) {
					interestRate = (interest / totalPrincipal) * 100;
				}
			} else if (transaction.interestType === 'rate') {
				interestRate = parseFloat(transaction.interestRate) || 0;
				const baseAmount = capital === 0 ? totalPrincipal : capital;
				interest = baseAmount * (interestRate / 100);
			} else {
				interest = parseFloat(transaction.interestAmount) || 0;
				if (capital > 0) interestRate = (interest / capital) * 100;
			}

			result.push({
				investor: si.investor,
				sentDate: transaction.sentDate,
				isPaid: transaction.isPaid,
				capital,
				interest,
				interestRate,
				total: capital + interest
			});
		}
	}

	return result;
}

export function calculateLoanFormSummary(
	selectedInvestors: SelectedInvestorAllocation[],
	calculateLoanStatus: () => LoanStatus
): LoanFormSummary {
	const preview = calculateLoanPreview(selectedInvestors);
	const totalCapital = preview.reduce((sum, p) => sum + p.capital, 0);
	const totalInterest = preview.reduce((sum, p) => sum + p.interest, 0);
	const totalAmount = totalCapital + totalInterest;
	const totalReceived = selectedInvestors.reduce(
		(sum, si) =>
			sum + si.receivedPayments.reduce((inner, rp) => inner + (parseFloat(rp.amount) || 0), 0),
		0
	);
	const totalBalance = totalAmount - totalReceived;
	const averageRate = totalCapital > 0 ? (totalInterest / totalCapital) * 100 : 0;
	const fundedCapital = preview.reduce((sum, p) => (p.isPaid ? sum + p.capital : sum), 0);

	return {
		totalCapital,
		totalInterest,
		totalAmount,
		totalReceived,
		totalBalance,
		averageRate,
		uniqueInvestors: selectedInvestors.length,
		status: calculateLoanStatus(),
		fundedCapital,
		balance: totalCapital - fundedCapital
	};
}

export function buildContractDraft(input: {
	borrowerName: string;
	borrowerAddress?: string | null;
	borrowerContact?: string | null;
	borrowerEmail?: string | null;
	borrowerValidIdUrl?: string | null;
	borrowerESignatureUrl?: string | null;
	loanName: string;
	type: LoanContractDraftInput['type'];
	dueDate: string;
	freeLotSqm: string;
	notes: string;
	selectedInvestors: SelectedInvestorAllocation[];
	summary: LoanFormSummary;
	loanId?: number;
}): LoanContractDraftInput {
	return {
		borrowerName: input.borrowerName,
		borrowerAddress: input.borrowerAddress,
		borrowerContact: input.borrowerContact,
		borrowerEmail: input.borrowerEmail,
		borrowerValidIdUrl: input.borrowerValidIdUrl,
		borrowerESignatureUrl: input.borrowerESignatureUrl,
		loanTitleLabel: input.loanName,
		type: input.type,
		dueDate: input.dueDate,
		freeLotSqm: input.freeLotSqm,
		notes: input.notes,
		loanId: input.loanId,
		investors: input.selectedInvestors.map((si) => ({
			investor: si.investor,
			transactions: si.transactions.map((t) => ({
				amount: t.amount,
				interestRate: t.interestRate,
				interestAmount: t.interestAmount,
				interestType: t.interestType,
				sentDate: t.sentDate
			})),
			hasMultipleInterest: si.hasMultipleInterest,
			interestPeriods: si.interestPeriods.map((period) => ({
				dueDate: period.dueDate,
				interestRate: period.interestRate,
				interestAmount: period.interestAmount,
				interestType: period.interestType
			}))
		})),
		totalPrincipal: input.summary.totalCapital,
		totalInterest: input.summary.totalInterest,
		totalAmountDue: input.summary.totalAmount
	};
}

export function buildInvestorsWithTransactionsForPreview(
	preview: LoanPreviewItem[],
	selectedInvestors: SelectedInvestorAllocation[]
): InvestorWithTransactions[] {
	const investorMap = new Map<number, LoanPreviewItem[]>();
	for (const item of preview) {
		const existing = investorMap.get(item.investor.id) ?? [];
		existing.push(item);
		investorMap.set(item.investor.id, existing);
	}

	const totalPrincipal = getTotalPrincipal(selectedInvestors);

	return Array.from(investorMap.values()).map((transactions) => {
		const investorId = transactions[0].investor.id;
		const investorData = selectedInvestors.find((si) => si.investor.id === investorId);

		return {
			investor: transactions[0].investor,
			receivedPayments:
				investorData?.receivedPayments.map((rp) => ({
					amount: rp.amount,
					receivedDate: rp.receivedDate,
					interestPeriodId: null,
					id: /^\d+$/.test(rp.id) ? parseInt(rp.id, 10) : undefined
				})) ?? [],
			transactions: transactions.map((t, index) => {
				const originalTransaction = investorData?.transactions.find(
					(ot) => ot.sentDate === t.sentDate
				);
				const isZeroCapitalWithRate =
					t.capital === 0 && originalTransaction?.interestType === 'rate';

				return {
					id: `preview-${t.investor.id}-${index}`,
					amount: t.capital.toString(),
					interestRate: isZeroCapitalWithRate
						? t.interest.toString()
						: originalTransaction?.interestType === 'fixed'
							? originalTransaction.interestAmount
							: t.interestRate.toString(),
					interestType: isZeroCapitalWithRate
						? 'fixed'
						: originalTransaction?.interestType || 'rate',
					sentDate: t.sentDate,
					isPaid: t.isPaid
				};
			}),
			hasMultipleInterest: investorData?.hasMultipleInterest || false,
			interestPeriods:
				investorData?.interestPeriods.map((period) => {
					const investorTotalCapital = investorData.transactions.reduce(
						(sum, t) => sum + (parseFloat(t.amount) || 0),
						0
					);
					const isZeroPeriodCapitalWithRate =
						investorTotalCapital === 0 && period.interestType === 'rate';

					if (isZeroPeriodCapitalWithRate) {
						const rate = parseFloat(period.interestRate) || 0;
						const calculatedInterest = totalPrincipal * (rate / 100);
						return {
							id: period.id,
							dueDate: period.dueDate,
							interestRate: calculatedInterest.toString(),
							interestType: 'fixed' as const
						};
					}

					return {
						id: period.id,
						dueDate: period.dueDate,
						interestRate:
							period.interestType === 'fixed' ? period.interestAmount : period.interestRate,
						interestType: period.interestType
					};
				}) ?? []
		};
	});
}
