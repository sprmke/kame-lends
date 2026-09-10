<script lang="ts">
	import { goto } from '$app/navigation';
	import { Calendar } from '$lib/components/common/calendar';
	import { isMobileShellViewport } from '$lib/composables/use-media-query.svelte';
	import LoanDetailModal from './LoanDetailModal.svelte';
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
		onUpdate?: () => void | Promise<void>;
	}

	let { loans, onLoanClick, onUpdate }: Props = $props();

	const calendarEvents = $derived(buildLoanCalendarEvents(loans));
	let selectedLoan = $state<LoanWithInvestors | null>(null);
	let isDetailModalOpen = $state(false);

	function handleLoanClick(loan: LoanWithInvestors) {
		if (onLoanClick) {
			onLoanClick(loan);
			return;
		}
		if (isMobileShellViewport()) {
			goto(`/loans/${loan.id}`);
			return;
		}
		selectedLoan = loan;
		isDetailModalOpen = true;
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
					{ label: 'Sent', color: 'bg-chart-3' },
					{ label: 'Scheduled', color: 'bg-chart-5' }
				]
			},
			{
				title: 'In',
				items: [
					{ label: 'Interest Due', color: 'bg-chart-4' },
					{ label: 'Due Date', color: 'bg-chart-2' }
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

{#if !onLoanClick}
	<LoanDetailModal
		loan={selectedLoan}
		open={isDetailModalOpen}
		onOpenChange={(open) => {
			isDetailModalOpen = open;
			if (!open) selectedLoan = null;
		}}
		{onUpdate}
	/>
{/if}
