<script lang="ts">
	import { cn } from '$lib/utils';
	import ActivityCardSlot from './ActivityCardSlot.svelte';
	import PastDueLoansCard from './PastDueLoansCard.svelte';
	import MaturingLoansCard from './MaturingLoansCard.svelte';
	import PendingDisbursementsCard from './PendingDisbursementsCard.svelte';
	import CompletedLoansCard from './CompletedLoansCard.svelte';
	import type { LoanWithInvestors } from '$lib/types';
	import type { PendingDisbursement } from '$lib/server/dashboard-data';

	interface Props {
		completedLoans: LoanWithInvestors[];
		overdueLoans: LoanWithInvestors[];
		pendingDisbursements: PendingDisbursement[];
		upcomingPaymentsDue: LoanWithInvestors[];
	}

	let {
		completedLoans,
		overdueLoans,
		pendingDisbursements,
		upcomingPaymentsDue
	}: Props = $props();

	const hasUpcomingPayouts = $derived(upcomingPaymentsDue.length > 0);
	const hasOverdueLoans = $derived(overdueLoans.length > 0);
	const hasPendingDisbursements = $derived(pendingDisbursements.length > 0);
	const hasCompletedLoans = $derived(completedLoans.length > 0);
	const hasAnyActivity = $derived(
		hasUpcomingPayouts ||
			hasOverdueLoans ||
			hasPendingDisbursements ||
			hasCompletedLoans
	);
	const showEmptyStates = $derived(!hasAnyActivity);
	const visibleCount = $derived(
		showEmptyStates
			? 4
			: Number(hasUpcomingPayouts) +
				Number(hasOverdueLoans) +
				Number(hasPendingDisbursements) +
				Number(hasCompletedLoans)
	);
	const gridColsClass = $derived(
		visibleCount >= 4
			? 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-4'
			: visibleCount === 3
				? 'grid-cols-1 md:grid-cols-3'
				: visibleCount === 2
					? 'grid-cols-1 md:grid-cols-2'
					: 'grid-cols-1'
	);
</script>

<div class={cn('grid w-full gap-2.5 md:gap-5', gridColsClass)}>
	<ActivityCardSlot visible={showEmptyStates || hasUpcomingPayouts}>
		<MaturingLoansCard loans={upcomingPaymentsDue} />
	</ActivityCardSlot>
	<ActivityCardSlot visible={showEmptyStates || hasOverdueLoans}>
		<PastDueLoansCard loans={overdueLoans} />
	</ActivityCardSlot>
	<ActivityCardSlot visible={showEmptyStates || hasPendingDisbursements}>
		<PendingDisbursementsCard disbursements={pendingDisbursements} />
	</ActivityCardSlot>
	<ActivityCardSlot visible={showEmptyStates || hasCompletedLoans}>
		<CompletedLoansCard loans={completedLoans} />
	</ActivityCardSlot>
</div>
