<script lang="ts">
	import ActivityPanelCard from './ActivityPanelCard.svelte';
	import { formatCurrency, formatText, formatDateShort } from '$lib/format';
	import { getLoanTypeBadge } from '$lib/badge-config';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';
	import { calculateTotalPrincipal } from '$lib/calculations';
	import { CheckCircle2 } from 'lucide-svelte';

	interface Props {
		loans: LoanWithInvestors[];
	}

	let { loans }: Props = $props();

	const displayLoans = $derived(
		[...loans].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
	);
</script>

<ActivityPanelCard
	title="Completed"
	count={loans.length}
	icon={CheckCircle2}
	accentClassName="bg-chart-4/12"
	iconClassName="text-chart-4"
	onViewAllClick={() => (window.location.href = '/loans?view=table&status=Completed')}
>
	{#if displayLoans.length === 0}
		<p class="py-2 text-center text-sm text-muted-foreground">No completed loans</p>
	{:else}
		<div class="dashboard-activity-list">
			{#each displayLoans as loan (loan.id)}
				<a href="/loans/{loan.id}" class="dashboard-activity-item">
					<div class="flex items-start justify-between gap-2">
						<p class="truncate text-sm font-medium">{formatText(loan.loanName)}</p>
						<Badge
							variant={getLoanTypeBadge(loan.type).variant}
							class={cn('shrink-0 text-[10px]', getLoanTypeBadge(loan.type).className)}
						>
							{formatText(loan.type)}
						</Badge>
					</div>
					<div class="flex items-center justify-between text-xs text-muted-foreground">
						<span>Completed {formatDateShort(loan.dueDate)}</span>
						<span class="font-medium tabular-nums"
							>{formatCurrency(calculateTotalPrincipal(loan.loanInvestors))}</span
						>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</ActivityPanelCard>
