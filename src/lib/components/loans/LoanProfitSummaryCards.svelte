<script lang="ts">
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import { formatCount } from '$lib/format';
	import type { ProfitStats } from '$lib/loan-list-summary';

	interface Props {
		stats: ProfitStats;
	}

	let { stats }: Props = $props();
</script>

<SummaryCard
	metrics={[
		{
			label: 'Principal',
			amount: stats.totalPrincipal
		},
		{
			label: 'Profit Estimate',
			amount: stats.profitEstimate
		},
		{
			label: 'Profit Earned',
			amount: stats.profitEarned,
			valueClassName: 'text-chart-2'
		},
		{
			label: 'Completed',
			value: `${formatCount(stats.completedCount)} / ${formatCount(stats.totalLoanCount)}`
		}
	]}
/>
