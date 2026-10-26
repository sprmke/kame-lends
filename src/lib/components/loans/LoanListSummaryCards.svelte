<script lang="ts">
	import SummaryCard, { type MetricItem } from '$lib/components/common/SummaryCard.svelte';
	import { formatCount, formatCurrencyShortAmountPhp } from '$lib/format';
	import type { LoanListSummaryStats } from '$lib/loan-list-summary';
	import {
		loanListMetricDetails,
		type SummaryDetailBasis,
		type SummaryDetailPlace
	} from '$lib/summary-metric-details';
	import { Activity, CheckCircle2, TrendingUp, Wallet } from 'lucide-svelte';

	interface Props {
		stats: LoanListSummaryStats;
		/** When false, the interest total is omitted and the other cards fill the row. */
		showInterest?: boolean;
		/** Which set of loans the figures describe. */
		detailPlace?: SummaryDetailPlace;
		/** `share` when the amounts are one person's allocation, not the whole loan. */
		detailBasis?: SummaryDetailBasis;
	}

	let { stats, showInterest = true, detailPlace = 'range', detailBasis = 'loan' }: Props = $props();

	function formatInterestPair(earned: number, estimate: number): string {
		return `${formatCurrencyShortAmountPhp(earned)} / ${formatCurrencyShortAmountPhp(estimate)}`;
	}

	const totalExposure = $derived(stats.currentCapital + stats.interestEstimate);

	const details = $derived(loanListMetricDetails(detailPlace, detailBasis));

	const metrics = $derived.by((): MetricItem[] => {
		const items: MetricItem[] = [
			{
				label: 'Principal',
				detail: details.principal,
				amount: stats.currentCapital,
				icon: Wallet,
				accentClassName: 'bg-primary/12 text-primary'
			},
			{
				label: 'Total',
				detail: details.total,
				amount: totalExposure,
				icon: Activity,
				accentClassName: 'bg-chart-5/15 text-chart-5'
			}
		];
		if (showInterest) {
			items.push({
				label: 'Interest',
				detail: details.interest,
				value: formatInterestPair(stats.interestEarned, stats.interestEstimate),
				icon: CheckCircle2,
				accentClassName: 'bg-chart-4/12 text-chart-4'
			});
		}
		items.push({
			label: 'Completed',
			detail: details.completed,
			value: `${formatCount(stats.completedCount)} / ${formatCount(stats.totalLoanCount)}`,
			icon: TrendingUp,
			accentClassName: 'bg-chart-2/12 text-chart-2'
		});
		return items;
	});

	const gridClass = $derived(showInterest ? undefined : 'grid-cols-2 lg:grid-cols-3');
</script>

<SummaryCard {metrics} class={gridClass} />
