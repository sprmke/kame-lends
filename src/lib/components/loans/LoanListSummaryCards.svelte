<script lang="ts">
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import { formatCount } from '$lib/format';
	import type { LoanListSummaryStats } from '$lib/loan-list-summary';

	interface Props {
		stats: LoanListSummaryStats;
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
			label: 'Interest Estimate',
			amount: stats.interestEstimate
		},
		{
			label: 'Interest Earned',
			amount: stats.interestEarned,
			valueClassName: 'text-chart-2'
		},
		{
			label: 'Completed',
			value: `${formatCount(stats.completedCount)} / ${formatCount(stats.totalLoanCount)}`
		}
	]}
/>
