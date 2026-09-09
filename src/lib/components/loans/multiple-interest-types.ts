export interface InterestPeriodData {
	id: string;
	dueDate: string;
	interestRate: string;
	interestAmount: string;
	interestType: 'rate' | 'fixed';
	status?: 'Pending' | 'Incomplete' | 'Completed' | 'Overdue';
}

export function sortInterestPeriodsByDueDate(periods: InterestPeriodData[]): InterestPeriodData[] {
	if (periods.length <= 1) return periods;
	const finalPeriod = periods[periods.length - 1];
	const intermediatePeriods = periods.slice(0, -1);
	const sortedIntermediate = [...intermediatePeriods].sort((a, b) =>
		a.dueDate.localeCompare(b.dueDate)
	);
	return [...sortedIntermediate, finalPeriod];
}

export function hasDuplicateInterestDueDates(periods: InterestPeriodData[]): boolean {
	const dates = periods.map((p) => p.dueDate).filter(Boolean);
	return new Set(dates).size !== dates.length;
}
