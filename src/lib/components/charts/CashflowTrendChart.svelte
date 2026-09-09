<script lang="ts">
	import { LineChart, Tooltip } from 'layerchart';
	import { curveMonotoneX } from 'd3-shape';
	import { Button } from '$lib/components/ui/button';
	import ChartShell from './ChartShell.svelte';
	import { CHART_HEIGHT, CHART_PALETTE, CHART_TOOLTIP_ROOT, chartEnterMotion } from './chart-theme';
	import { formatChartAxis, formatCurrency } from '$lib/format';
	import { TrendingUp } from 'lucide-svelte';
	import type { CashflowDataPoint } from '$lib/server/dashboard-data';

	type TimePeriod = 'day' | 'week' | 'month';

	interface Props {
		dailyData: CashflowDataPoint[];
		weeklyData: CashflowDataPoint[];
		monthlyData: CashflowDataPoint[];
		title?: string;
		emptyMessage?: string;
	}

	let {
		dailyData,
		weeklyData,
		monthlyData,
		title = 'Cashflow Trend',
		emptyMessage = 'No cashflow data'
	}: Props = $props();

	let period = $state<TimePeriod>('week');

	const series = [
		{ key: 'inflow', label: 'Inflow', color: CHART_PALETTE.teal },
		{ key: 'outflow', label: 'Outflow', color: CHART_PALETTE.coral },
		{ key: 'net', label: 'Net', color: CHART_PALETTE.primary }
	];

	const data = $derived(
		period === 'day' ? dailyData : period === 'week' ? weeklyData : monthlyData
	);

	const isEmpty = $derived(
		!data?.length || data.every((item) => item.inflow === 0 && item.outflow === 0 && item.net === 0)
	);

	const periodLabels: Record<TimePeriod, string> = {
		day: 'Day',
		week: 'Week',
		month: 'Month'
	};

	const enterMotion = chartEnterMotion();
</script>

{#snippet headerActions()}
	<div class="flex flex-wrap items-center justify-end gap-3">
		<div class="hidden items-center gap-3 sm:flex">
			{#each series as s (s.key)}
				<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<span class="size-2 rounded-full" style="background: {s.color}"></span>
					{s.label}
				</div>
			{/each}
		</div>
		<div class="pill-segment self-start">
			{#each ['day', 'week', 'month'] as p}
				<Button
					variant={period === p ? 'secondary' : 'ghost'}
					size="sm"
					class="h-8 rounded-xl px-3.5 text-xs font-semibold"
					onclick={() => (period = p as TimePeriod)}
				>
					{periodLabels[p as TimePeriod]}
				</Button>
			{/each}
		</div>
	</div>
{/snippet}

<ChartShell {title} action={headerActions}>
	{#if isEmpty}
		<div class="empty-state-well h-[{CHART_HEIGHT}px] gap-2 text-muted-foreground">
			<TrendingUp class="h-8 w-8 opacity-40" />
			<p class="text-sm">{emptyMessage}</p>
		</div>
	{:else}
		<div class="chart-canvas" style="height: {CHART_HEIGHT}px">
			<LineChart
				{data}
				x="label"
				{series}
				legend={false}
				axis
				grid
				rule={false}
				highlight={{ lines: true, points: true }}
				props={{
					spline: {
						curve: curveMonotoneX,
						strokeWidth: 2.5,
						motion: enterMotion
					},
					grid: {
						stroke: 'var(--border)',
						opacity: 0.7
					},
					yAxis: {
						format: formatChartAxis,
						tickMarks: false
					},
					xAxis: {
						tickMarks: false,
						tickOcclusion: { padding: 12, priority: 'start-end' },
						tickLabelProps: {
							class: 'text-[11px] fill-muted-foreground'
						}
					},
					highlight: {
						motion: { type: 'tween', duration: 150 }
					},
					tooltip: { root: CHART_TOOLTIP_ROOT }
				}}
			>
				{#snippet tooltip()}
					<Tooltip.Root {...CHART_TOOLTIP_ROOT}>
						{#snippet children({ data: row }: { data: CashflowDataPoint })}
							<p class="chart-tooltip-title">{row.label}</p>
							<Tooltip.List>
								{#each series as s (s.key)}
									<Tooltip.Item
										label={s.label}
										value={formatCurrency(row[s.key as keyof CashflowDataPoint] as number)}
										color={s.color}
										valueAlign="right"
									/>
								{/each}
							</Tooltip.List>
						{/snippet}
					</Tooltip.Root>
				{/snippet}
			</LineChart>
		</div>
	{/if}
</ChartShell>
