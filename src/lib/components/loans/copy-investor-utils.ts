import type {
	LoanFormReceivedPayment,
	LoanFormTransaction,
	SelectedInvestorAllocation
} from './loan-form-types';
import type { InterestPeriodData } from './multiple-interest-types';

export interface InvestorConfiguration {
	transactions: LoanFormTransaction[];
	receivedPayments: LoanFormReceivedPayment[];
	hasMultipleInterest: boolean;
	interestPeriods: InterestPeriodData[];
}

export function toInvestorConfiguration(
	allocation: SelectedInvestorAllocation
): InvestorConfiguration {
	return {
		transactions: allocation.transactions,
		receivedPayments: allocation.receivedPayments,
		hasMultipleInterest: allocation.hasMultipleInterest,
		interestPeriods: allocation.interestPeriods
	};
}

export function configurationsMatch(
	config1: InvestorConfiguration,
	config2: InvestorConfiguration
): boolean {
	if (config1.hasMultipleInterest !== config2.hasMultipleInterest) return false;

	if (config1.transactions.length !== config2.transactions.length) return false;

	const sortTransactions = (txns: LoanFormTransaction[]) =>
		[...txns].sort((a, b) => a.sentDate.localeCompare(b.sentDate));

	const sorted1 = sortTransactions(config1.transactions);
	const sorted2 = sortTransactions(config2.transactions);

	for (let i = 0; i < sorted1.length; i++) {
		const t1 = sorted1[i];
		const t2 = sorted2[i];
		if (
			t1.amount !== t2.amount ||
			t1.interestType !== t2.interestType ||
			t1.sentDate !== t2.sentDate
		) {
			return false;
		}
		if (t1.interestType === 'rate') {
			if (t1.interestRate !== t2.interestRate) return false;
		} else if (t1.interestAmount !== t2.interestAmount) {
			return false;
		}
	}

	if (config1.receivedPayments.length !== config2.receivedPayments.length) return false;
	const sortReceived = (payments: LoanFormReceivedPayment[]) =>
		[...payments].sort((a, b) => a.receivedDate.localeCompare(b.receivedDate));
	const sortedRp1 = sortReceived(config1.receivedPayments);
	const sortedRp2 = sortReceived(config2.receivedPayments);
	for (let i = 0; i < sortedRp1.length; i++) {
		if (
			sortedRp1[i].amount !== sortedRp2[i].amount ||
			sortedRp1[i].receivedDate !== sortedRp2[i].receivedDate
		) {
			return false;
		}
	}

	if (config1.hasMultipleInterest) {
		if (config1.interestPeriods.length !== config2.interestPeriods.length) return false;
		const sortPeriods = (periods: InterestPeriodData[]) =>
			[...periods].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
		const sortedPeriods1 = sortPeriods(config1.interestPeriods);
		const sortedPeriods2 = sortPeriods(config2.interestPeriods);
		for (let i = 0; i < sortedPeriods1.length; i++) {
			const p1 = sortedPeriods1[i];
			const p2 = sortedPeriods2[i];
			if (p1.dueDate !== p2.dueDate || p1.interestType !== p2.interestType) return false;
			if (p1.interestType === 'rate') {
				if (p1.interestRate !== p2.interestRate) return false;
			} else if (p1.interestAmount !== p2.interestAmount) {
				return false;
			}
		}
	}

	return true;
}

export function findInvestorsWithSameConfig(
	targetConfig: InvestorConfiguration,
	availableInvestorIds: number[],
	selectedInvestorsConfigs: Map<number, InvestorConfiguration>
): number[] {
	const matchingIds: number[] = [];
	for (const investorId of availableInvestorIds) {
		const investorConfig = selectedInvestorsConfigs.get(investorId);
		if (investorConfig && configurationsMatch(targetConfig, investorConfig)) {
			matchingIds.push(investorId);
		}
	}
	return matchingIds;
}
