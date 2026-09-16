<script lang="ts">
	import { cn } from '$lib/utils';
	import ActivityCardSlot from './ActivityCardSlot.svelte';
	import PastDueLoansCard from './PastDueLoansCard.svelte';
	import MaturingLoansCard from './MaturingLoansCard.svelte';
	import PendingDisbursementsCard from './PendingDisbursementsCard.svelte';
	import CompletedLoansCard from './CompletedLoansCard.svelte';
	import DashboardGroupsCard from '$lib/components/dashboard/DashboardGroupsCard.svelte';
	import type { LoanWithInvestors } from '$lib/types';
	import type { PendingDisbursement } from '$lib/server/dashboard-data';
	import type { GroupsIndexItem } from '$lib/groups/loan-group-filter';

	interface Props {
		completedLoans: LoanWithInvestors[];
		overdueLoans: LoanWithInvestors[];
		pendingDisbursements: PendingDisbursement[];
		upcomingPaymentsDue: LoanWithInvestors[];
		groupsPreview?: GroupsIndexItem[];
		groupsTotalCount?: number;
	}

	let {
		completedLoans,
		overdueLoans,
		pendingDisbursements,
		upcomingPaymentsDue,
		groupsPreview = [],
		groupsTotalCount = 0
	}: Props = $props();

	const hasUpcomingPayouts = $derived(upcomingPaymentsDue.length > 0);
	const hasOverdueLoans = $derived(overdueLoans.length > 0);
	const hasPendingDisbursements = $derived(pendingDisbursements.length > 0);
	const hasCompletedLoans = $derived(completedLoans.length > 0);
	const hasGroupsCard = $derived(groupsPreview.length > 0);
	const hasAnyActivity = $derived(
		hasUpcomingPayouts ||
			hasOverdueLoans ||
			hasPendingDisbursements ||
			hasCompletedLoans ||
			hasGroupsCard
	);
</script>

<div
	class={cn('grid gap-2.5 md:grid-cols-2 md:gap-5 2xl:grid-cols-4', !hasAnyActivity && 'hidden 2xl:grid')}
>
	<ActivityCardSlot visibleBelowLarge={hasUpcomingPayouts}>
		<MaturingLoansCard loans={upcomingPaymentsDue} />
	</ActivityCardSlot>
	<ActivityCardSlot visibleBelowLarge={hasOverdueLoans}>
		<PastDueLoansCard loans={overdueLoans} />
	</ActivityCardSlot>
	<ActivityCardSlot visibleBelowLarge={hasPendingDisbursements}>
		<PendingDisbursementsCard disbursements={pendingDisbursements} />
	</ActivityCardSlot>
	<ActivityCardSlot visibleBelowLarge={hasCompletedLoans}>
		<CompletedLoansCard loans={completedLoans} />
	</ActivityCardSlot>
	{#if hasGroupsCard}
		<ActivityCardSlot visibleBelowLarge={true}>
			<DashboardGroupsCard groups={groupsPreview} totalCount={groupsTotalCount} />
		</ActivityCardSlot>
	{/if}
</div>
