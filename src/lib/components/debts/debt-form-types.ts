import { toLocalDateString } from '$lib/date-utils';
import { normalizeInterestRate } from '$lib/debt-calculations';
import type { DebtInterestInterval, DebtWithInvestor } from '$lib/types';

export interface DebtFeeEntry {
	id: string;
	label: string;
	amount: string;
}

export interface DebtFormEntry {
	id: string;
	name: string;
	amount: string;
	debtDate: string;
	interestRate: string;
	interestInterval: DebtInterestInterval;
	durationMonths: string;
	additionalFees: DebtFeeEntry[];
	notes: string;
}

export const DEBT_INTEREST_INTERVAL_OPTIONS: { value: DebtInterestInterval; label: string }[] = [
	{ value: 'Daily', label: 'Daily' },
	{ value: 'Weekly', label: 'Weekly' },
	{ value: 'Monthly', label: 'Monthly' },
	{ value: 'Annually', label: 'Annually' }
];

export function makeDebtFee(id: string): DebtFeeEntry {
	return { id, label: '', amount: '' };
}

export function makeDebtEntry(id: string): DebtFormEntry {
	return {
		id,
		name: '',
		amount: '',
		debtDate: toLocalDateString(new Date()),
		interestRate: '',
		interestInterval: 'Monthly',
		durationMonths: '12',
		additionalFees: [],
		notes: ''
	};
}

export function debtToEntry(debt: DebtWithInvestor, id: string): DebtFormEntry {
	const dateValue = debt.date instanceof Date ? debt.date : new Date(String(debt.date));
	return {
		id,
		name: debt.name,
		amount: String(debt.amount),
		debtDate: toLocalDateString(dateValue),
		interestRate: normalizeInterestRate(debt.interestRate),
		interestInterval: debt.interestInterval,
		durationMonths: String(debt.durationMonths ?? 12),
		additionalFees: (debt.additionalFees ?? []).map((fee, index) => ({
			id: `${id}-fee-${index}`,
			label: fee.label,
			amount: String(fee.amount)
		})),
		notes: debt.notes ?? ''
	};
}
