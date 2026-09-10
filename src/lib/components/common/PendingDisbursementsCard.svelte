<script lang="ts">
	import ActivityPanelCard from './ActivityPanelCard.svelte';
	import { formatCurrency, formatText, formatDateShort } from '$lib/format';
	import { getLoanTypeBadge } from '$lib/badge-config';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import type { LoanType } from '$lib/types';
	import type { PendingDisbursement } from '$lib/server/dashboard-data';
	import { Send } from 'lucide-svelte';

	interface Props {
		disbursements: PendingDisbursement[];
	}

	let { disbursements }: Props = $props();

	const displayItems = $derived(
		[...disbursements].sort(
			(a, b) => new Date(a.sentDate).getTime() - new Date(b.sentDate).getTime()
		)
	);
</script>

<ActivityPanelCard
	title="Pending Disbursements"
	count={disbursements.length}
	icon={Send}
	accentClassName="bg-primary/12"
	iconClassName="text-primary"
	onViewAllClick={() => (window.location.href = '/loans?view=table')}
>
	{#if displayItems.length === 0}
		<p class="py-2 text-center text-sm text-muted-foreground">No pending disbursements</p>
	{:else}
		<div class="dashboard-activity-list">
			{#each displayItems as item (item.id)}
				<a href="/loans/{item.loanId}" class="dashboard-activity-item">
					<div class="flex items-start justify-between gap-2">
						<p class="truncate text-sm font-medium">{formatText(item.loanName)}</p>
						<Badge
							variant={getLoanTypeBadge(item.loanType as LoanType).variant}
							class={cn(
								'shrink-0 text-[10px]',
								getLoanTypeBadge(item.loanType as LoanType).className
							)}
						>
							{formatText(item.loanType)}
						</Badge>
					</div>
					<div class="flex items-center justify-between text-xs text-muted-foreground">
						<span>{formatText(item.investorName)}</span>
						<span class="font-medium tabular-nums">{formatCurrency(item.amount)}</span>
					</div>
					<p class="text-[10px] text-muted-foreground">Sent {formatDateShort(item.sentDate)}</p>
				</a>
			{/each}
		</div>
	{/if}
</ActivityPanelCard>
