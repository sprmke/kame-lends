<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import GroupBadgeList from '$lib/components/groups/GroupBadgeList.svelte';
	import { SHOW_GROUPS_UI } from '$lib/feature-flags';
	import { formatText } from '$lib/format';
	import {
		badgesForLoan,
		loanGroupIds,
		type GroupsIndexItem
	} from '$lib/groups/loan-group-filter';
	import LoanPendingSignBadge from '$lib/components/loans/LoanPendingSignBadge.svelte';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';
	import { page } from '$app/state';

	interface Props {
		loan: LoanWithInvestors;
		badgeClass: string;
		showGroupBadges?: boolean;
		onOpenContractDetails?: () => void;
	}

	let {
		loan,
		badgeClass,
		showGroupBadges = false,
		onOpenContractDetails
	}: Props = $props();

	const groupsIndex = $derived(
		((page.data as { groupsIndex?: GroupsIndexItem[] }).groupsIndex ?? []) as GroupsIndexItem[]
	);
	const showGroupRow = $derived(SHOW_GROUPS_UI && showGroupBadges);
	const groupBadges = $derived(showGroupRow ? badgesForLoan(loan, groupsIndex) : []);
	const isUngrouped = $derived(showGroupRow && loanGroupIds(loan).length === 0);
</script>

<div class="flex min-w-0 flex-wrap items-center gap-1">
	{#if showGroupRow && groupBadges.length > 0}
		<GroupBadgeList groups={groupBadges} />
	{:else if showGroupRow && isUngrouped}
		<span
			class="inline-flex max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
		>
			<span
				class="size-2 shrink-0 rounded-full bg-muted-foreground/40"
				aria-hidden="true"
			></span>
			<span class="truncate">Ungrouped</span>
		</span>
	{/if}
	<Badge
		variant={getLoanTypeBadge(loan.type).variant}
		class={cn(badgeClass, 'shrink-0 leading-none', getLoanTypeBadge(loan.type).className)}
	>
		{formatText(loan.type)}
	</Badge>
	<Badge
		variant={getLoanStatusBadge(loan.status).variant}
		class={cn(badgeClass, 'shrink-0 leading-none', getLoanStatusBadge(loan.status).className)}
	>
		{formatText(loan.status)}
	</Badge>
	<LoanPendingSignBadge
		{loan}
		compact
		class={cn(badgeClass, 'mt-0 shrink-0 leading-none')}
		{onOpenContractDetails}
	/>
</div>
