<script lang="ts">
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import { formatCount, formatCurrencyShortAmount } from '$lib/format';
	import type { LoanListSummaryStats } from '$lib/loan-list-summary';

	interface Props {
		stats: LoanListSummaryStats;
	}

	let { stats }: Props = $props();

	function formatPrincipalPair(current: number, invested: number): string {
		return `${formatCurrencyShortAmount(current)} / ${formatCurrencyShortAmount(invested)}`;
	}
</script>

<SummaryCard
	metrics={[
		{
			label: 'Principal',
			value: formatPrincipalPair(stats.currentCapital, stats.totalCapitalInvested)
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
