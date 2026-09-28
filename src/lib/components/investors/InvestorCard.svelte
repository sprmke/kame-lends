<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import GridListCardShell from '$lib/components/common/GridListCardShell.svelte';
	import { createRowActionItems } from '$lib/components/common/action-buttons';
	import { formatCurrencyCompact, formatPercentage, formatText } from '$lib/format';
	import { calculateAverageRate, calculateInvestorStats } from '$lib/calculations';
	import type { InvestorWithLoans } from '$lib/types';

	interface Props {
		investor: InvestorWithLoans;
		viewHref?: string;
		onQuickView?: (investor: InvestorWithLoans) => void;
		onEdit?: (investor: InvestorWithLoans) => void;
		onDelete?: (investor: InvestorWithLoans) => void;
	}

	let {
		investor,
		viewHref = `/investors/${investor.id}`,
		onQuickView,
		onEdit,
		onDelete
	}: Props = $props();

	const stats = $derived(calculateInvestorStats(investor));
	const avgRate = $derived(calculateAverageRate(investor.loanInvestors));

	const actionItems = $derived(
		createRowActionItems({
			onEdit: onEdit ? () => onEdit(investor) : undefined,
			onDelete: onDelete ? () => onDelete(investor) : undefined
		})
	);
</script>

<GridListCardShell
	{viewHref}
	{actionItems}
	onQuickView={onQuickView ? () => onQuickView(investor) : undefined}
>
	{#snippet header()}
		<Card.Title class="mb-2 truncate text-sm sm:text-base">{formatText(investor.name)}</Card.Title>
	{/snippet}
	{#snippet children()}
		<p class="truncate text-xs text-muted-foreground">{formatText(investor.email)}</p>
		<div class="grid grid-cols-2 gap-1.5">
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Capital</p>
				<p class="text-xs font-semibold tabular-nums">
					{formatCurrencyCompact(stats.totalCapital)}
				</p>
			</div>
			<div class="dashboard-metric-cell p-2">
				<p class="mb-1 text-[10px] text-muted-foreground">Rate</p>
				<p class="text-xs font-semibold tabular-nums">{formatPercentage(avgRate)}</p>
			</div>
		</div>
	{/snippet}
</GridListCardShell>
