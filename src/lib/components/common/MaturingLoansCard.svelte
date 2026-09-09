<script lang="ts">
	import ActivityPanelCard from './ActivityPanelCard.svelte';
	import { formatCurrency, formatText, formatDateShort } from '$lib/format';
	import { getLoanTypeBadge } from '$lib/badge-config';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import type { LoanWithInvestors } from '$lib/types';
	import { calculateTotalPrincipal } from '$lib/calculations';
	import { CalendarClock } from 'lucide-svelte';

	interface Props {
		loans: LoanWithInvestors[];
	}

	let { loans }: Props = $props();

	const displayLoans = $derived(
		[...loans].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
	);
</script>

<ActivityPanelCard
	title="Maturing Soon"
	count={loans.length}
	icon={CalendarClock}
	accentClassName="bg-chart-5/15"
	iconClassName="text-chart-5"
	stripeClassName="bg-chart-5"
	onViewAllClick={() => (window.location.href = '/loans?view=table')}
>
	{#if displayLoans.length === 0}
		<p class="py-4 text-center text-sm text-muted-foreground">No loans maturing soon</p>
	{:else}
		<div class="max-h-64 space-y-2 overflow-y-auto pr-1">
			{#each displayLoans.slice(0, 5) as loan (loan.id)}
				<a href="/loans/{loan.id}" class="dashboard-activity-item">
					<div class="flex items-start justify-between gap-2">
						<p class="truncate text-sm font-semibold">{formatText(loan.loanName)}</p>
						<Badge
							variant={getLoanTypeBadge(loan.type).variant}
							class={cn('shrink-0 text-[10px]', getLoanTypeBadge(loan.type).className)}
						>
							{formatText(loan.type)}
						</Badge>
					</div>
					<div class="flex items-center justify-between text-xs text-muted-foreground">
						<span>Due {formatDateShort(loan.dueDate)}</span>
						<span class="font-semibold"
							>{formatCurrency(calculateTotalPrincipal(loan.loanInvestors))}</span
						>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</ActivityPanelCard>
