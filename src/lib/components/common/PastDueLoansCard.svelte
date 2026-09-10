<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import ActivityPanelCard from './ActivityPanelCard.svelte';
	import { formatCurrency, formatText, formatDateShort } from '$lib/format';
	import { getLoanTypeBadge } from '$lib/badge-config';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors, LoanType } from '$lib/types';
	import { calculateOverdueAmount } from '$lib/calculations';
	import { TriangleAlert } from 'lucide-svelte';

	interface Props {
		loans: LoanWithInvestors[];
		onTypeFilterClick?: (type: LoanType) => void;
	}

	let { loans, onTypeFilterClick }: Props = $props();

	const displayLoans = $derived(
		[...loans].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
	);

	const totalAmount = $derived(
		loans.reduce((sum, loan) => sum + calculateOverdueAmount(loan.loanInvestors), 0)
	);
</script>

{#snippet listContent()}
	{#if displayLoans.length === 0}
		<p class="py-2 text-center text-sm text-muted-foreground">No overdue loans</p>
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
						<span>Due {formatDateShort(loan.dueDate)}</span>
						<span class="font-medium text-destructive tabular-nums">
							{formatCurrency(calculateOverdueAmount(loan.loanInvestors))}
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
{/snippet}

<ActivityPanelCard
	title="Past Due"
	count={loans.length}
	icon={TriangleAlert}
	accentClassName="bg-destructive/12"
	iconClassName="text-destructive"
	onViewAllClick={() => (window.location.href = '/loans?view=table&status=Overdue')}
>
	{@render listContent()}
</ActivityPanelCard>
