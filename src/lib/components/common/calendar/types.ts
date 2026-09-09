import type { Snippet } from 'svelte';
import type { InterestPeriod, LoanInvestor, LoanWithInvestors, Transaction } from '$lib/types';

export type ViewMode = 'day' | 'week' | 'month';

export interface CalendarEventBase {
	date: Date;
}

export interface CalendarEventSent extends CalendarEventBase {
	type: 'sent';
	loan: LoanWithInvestors;
	investors: Array<{
		name: string;
		amount: number;
	}>;
	totalAmount: number;
	hasUnpaidTransactions: boolean;
}

export interface CalendarEventDue extends CalendarEventBase {
	type: 'due';
	loan: LoanWithInvestors;
	totalPrincipal: number;
	totalInterest: number;
	totalAmount: number;
}

export interface CalendarEventInterestDue extends CalendarEventBase {
	type: 'interest_due';
	loan: LoanWithInvestors;
	loanInvestor: LoanInvestor & { investor: { name: string } };
	interestPeriod: InterestPeriod;
	principal: number;
	interest: number;
	totalAmount: number;
}

export interface CalendarEventTransaction extends CalendarEventBase {
	type: 'transaction';
	transaction: Transaction;
	amount: number;
	direction: 'In' | 'Out';
}

export type CalendarEvent =
	CalendarEventSent | CalendarEventDue | CalendarEventInterestDue | CalendarEventTransaction;

export interface CalendarCell {
	date: Date;
	isCurrentMonth: boolean;
	events: CalendarEvent[];
}

export interface LegendItem {
	label: string;
	color: string;
}

export interface LegendGroup {
	title: string;
	items: LegendItem[];
}

export interface CalendarConfig {
	formatCurrency: (amount: number) => string;
	onEventClick: (event: CalendarEvent) => void;
	eventCard?: Snippet<[event: CalendarEvent, eventIndex: number]>;
	alwaysShowSummary?: boolean;
	legendGroups?: LegendGroup[];
}
