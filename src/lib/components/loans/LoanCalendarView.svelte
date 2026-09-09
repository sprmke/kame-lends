<script lang="ts">
	import { goto } from '$app/navigation';
	import { Calendar } from '$lib/components/common/calendar';
	import type {
		CalendarConfig,
		CalendarEvent,
		CalendarEventDue,
		CalendarEventInterestDue,
		CalendarEventSent
	} from '$lib/components/common/calendar/types';
	import { buildLoanCalendarEvents } from '$lib/composables/use-loan-calendar-events';
	import { formatCurrencyCompact } from '$lib/format';
	import type { LoanWithInvestors } from '$lib/types';
	import LoanDueEventCard from './LoanDueEventCard.svelte';
	import LoanInterestDueEventCard from './LoanInterestDueEventCard.svelte';
	import LoanSentEventCard from './LoanSentEventCard.svelte';

	interface Props {
		loans: LoanWithInvestors[];
		onLoanClick?: (loan: LoanWithInvestors) => void;
	}

	let { loans, onLoanClick }: Props = $props();

	const calendarEvents = $derived(buildLoanCalendarEvents(loans));

	function handleLoanClick(loan: LoanWithInvestors) {
		if (onLoanClick) {
			onLoanClick(loan);
		} else {
			goto(`/loans/${loan.id}`);
		}
	}

	const calendarConfig: CalendarConfig = {
		formatCurrency: formatCurrencyCompact,
		onEventClick: (event) => {
			if (event.type === 'sent') {
				handleLoanClick((event as CalendarEventSent).loan);
			} else if (event.type === 'due') {
				handleLoanClick((event as CalendarEventDue).loan);
			} else if (event.type === 'interest_due') {
				handleLoanClick((event as CalendarEventInterestDue).loan);
			}
		},
		legendGroups: [
			{
				title: 'Out',
				items: [
					{ label: 'Sent', color: 'bg-rose-400' },
					{ label: 'Scheduled', color: 'bg-amber-300' }
				]
			},
			{
				title: 'In',
				items: [
					{ label: 'Interest Due', color: 'bg-sky-400' },
					{ label: 'Due Date', color: 'bg-emerald-400' }
				]
			}
		]
	};
</script>

{#snippet eventCard(event: CalendarEvent, eventIndex: number)}
	{#if event.type === 'sent'}
		{@const sentEvent = event as CalendarEventSent}
		<LoanSentEventCard
			loan={sentEvent.loan}
			onclick={() => handleLoanClick(sentEvent.loan)}
			formatCurrency={formatCurrencyCompact}
			investors={sentEvent.investors}
			totalAmount={sentEvent.totalAmount}
			size="sm"
			isFuture={sentEvent.hasUnpaidTransactions}
		/>
	{:else if event.type === 'due'}
		{@const dueEvent = event as CalendarEventDue}
		<LoanDueEventCard
			loan={dueEvent.loan}
			onclick={() => handleLoanClick(dueEvent.loan)}
			formatCurrency={formatCurrencyCompact}
			totalPrincipal={dueEvent.totalPrincipal}
			totalInterest={dueEvent.totalInterest}
			totalAmount={dueEvent.totalAmount}
			size="sm"
		/>
	{:else if event.type === 'interest_due'}
		{@const interestDueEvent = event as CalendarEventInterestDue}
		<LoanInterestDueEventCard
			loan={interestDueEvent.loan}
			onclick={() => handleLoanClick(interestDueEvent.loan)}
			formatCurrency={formatCurrencyCompact}
			investorName={interestDueEvent.loanInvestor.investor.name}
			principal={interestDueEvent.principal}
			interest={interestDueEvent.interest}
			totalAmount={interestDueEvent.totalAmount}
			size="sm"
		/>
	{/if}
{/snippet}

<Calendar
	events={calendarEvents}
	config={{
		...calendarConfig,
		eventCard
	}}
/>
