<script lang="ts">
	import ContactInfoCard from '$lib/components/common/ContactInfoCard.svelte';
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { formatDateVeryShort, formatText } from '$lib/format';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { calculateBorrowerStats } from '$lib/calculations';
	import { buildTotalLotMetric } from '$lib/lot-utils';
	import { BORROWER_DETAIL_SUMMARY_GRID } from '$lib/summary-grid';
	import { cn } from '$lib/utils';
	import type { BorrowerWithLoans } from '$lib/types';

	interface Props {
		borrower: BorrowerWithLoans;
		showHeader?: boolean;
	}

	let { borrower, showHeader = true }: Props = $props();

	const loans = $derived(borrower.loans ?? []);
	const stats = $derived(calculateBorrowerStats(borrower));
</script>

<div class="dashboard-stack">
	{#if showHeader}
		<div class="space-y-1">
			<h2 class="text-base font-medium tracking-tight">{formatText(borrower.name)}</h2>
		</div>
	{/if}

	<ContactInfoCard
		name={borrower.name}
		email={borrower.email}
		contactNumber={borrower.contactNumber}
		address={borrower.address}
	/>

	{#if loans.length > 0}
		<SummaryCard
			class={BORROWER_DETAIL_SUMMARY_GRID}
			metrics={[
				{
					label: 'Active Balance',
					amount: stats.activePrincipal,
					subCount: stats.openLoans,
					subCountSuffix: ' open loans'
				},
				{
					label: 'Interest',
					amount: stats.activeInterest,
					subValue: 'Open loans'
				},
				{
					label: 'Total Due',
					amount: stats.activeTotal,
					subValue: 'Principal + interest'
				},
				{
					label: 'Overdue',
					amount: stats.overdueAmount,
					subCount: stats.overdueLoans,
					subCountSuffix: stats.overdueLoans === 1 ? ' loan' : ' loans',
					empty: stats.overdueLoans === 0,
					valueClassName: stats.overdueAmount > 0 ? 'text-chart-3' : undefined
				},
				{
					label: 'Completed',
					value: String(stats.completedLoans),
					subValue: stats.completedLoans === 1 ? 'Loan closed' : 'Loans closed',
					empty: stats.completedLoans === 0
				},
				buildTotalLotMetric(stats.totalLot, stats.totalLotWithDepacto)
			]}
		/>
	{/if}

	{#if borrower.notes}
		<div class="space-y-1">
			<p class="text-xs font-semibold text-muted-foreground">Notes</p>
			<p class="text-sm text-muted-foreground">{borrower.notes}</p>
		</div>
	{/if}

	<div class="space-y-3">
		<h3 class="text-sm font-semibold">Loans ({loans.length})</h3>
		{#if loans.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">No loans yet</Card.Content>
			</Card.Root>
		{:else}
			{#each loans as loan (loan.id)}
				<Card.Root>
					<Card.Content
						class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="min-w-0 space-y-1">
							<p class="truncate font-medium">{formatText(loan.loanName)}</p>
							<p class="text-sm text-muted-foreground">
								Due {formatDateVeryShort(loan.dueDate)}
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<Badge
								variant={getLoanTypeBadge(loan.type).variant}
								class={cn('text-[10px]', getLoanTypeBadge(loan.type).className)}
							>
								{loan.type}
							</Badge>
							<Badge
								variant={getLoanStatusBadge(loan.status).variant}
								class={cn('text-[10px]', getLoanStatusBadge(loan.status).className)}
							>
								{loan.status}
							</Badge>
							<Button href="/loans/{loan.id}" variant="outline" size="sm">Open</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		{/if}
	</div>
</div>
