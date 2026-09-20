<script lang="ts">
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import { formatCount, formatCurrencyShortAmountPhp } from '$lib/format';
	import type { LoanListSummaryStats } from '$lib/loan-list-summary';

	interface Props {
		stats: LoanListSummaryStats;
	}

	let { stats }: Props = $props();

	function formatInterestPair(earned: number, estimate: number): string {
		return `${formatCurrencyShortAmountPhp(earned)} / ${formatCurrencyShortAmountPhp(estimate)}`;
	}

	const totalExposure = $derived(stats.currentCapital + stats.interestEstimate);
</script>

<SummaryCard
	metrics={[
		{
			label: 'Principal',
			amount: stats.currentCapital
		},
		{
			label: 'Total',
			amount: totalExposure
		},
		{
			label: 'Interest',
			value: formatInterestPair(stats.interestEarned, stats.interestEstimate)
		},
		{
			label: 'Completed',
			value: `${formatCount(stats.completedCount)} / ${formatCount(stats.totalLoanCount)}`
		}
	]}
/>
