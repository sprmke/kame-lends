<script lang="ts">
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import { formatCount } from '$lib/format';
	import type { ProfitStats } from '$lib/loan-list-summary';
	import {
		commissionMetricDetails,
		type SummaryDetailPlace
	} from '$lib/summary-metric-details';

	interface Props {
		stats: ProfitStats;
		detailPlace?: SummaryDetailPlace;
	}

	let { stats, detailPlace = 'range' }: Props = $props();

	const details = $derived(commissionMetricDetails(detailPlace));
</script>

<SummaryCard
	metrics={[
		{
			label: 'Principal',
			detail: details.principal,
			amount: stats.totalPrincipal
		},
		{
			label: 'Com Estimate',
			detail: details.estimate,
			amount: stats.profitEstimate
		},
		{
			label: 'Com Earned',
			detail: details.earned,
			amount: stats.profitEarned,
			valueClassName: 'text-chart-2',
			empty: false
		},
		{
			label: 'Completed',
			detail: details.completed,
			value: `${formatCount(stats.completedCount)} / ${formatCount(stats.totalLoanCount)}`
		}
	]}
/>
