<script lang="ts">
	import { BarChart, Tooltip } from 'layerchart';
	import ChartShell from './ChartShell.svelte';
	import { CHART_HEIGHT, CHART_PALETTE, CHART_TOOLTIP_ROOT, chartEnterMotion } from './chart-theme';
	import { formatChartAxis, formatCurrency } from '$lib/format';
	import { TrendingUp } from 'lucide-svelte';
	import type { InvestorCapitalRow } from '$lib/server/dashboard-data';

	interface DataKey {
		key: string;
		label: string;
		color: string;
	}

	interface Props {
		data: InvestorCapitalRow[];
		title?: string;
		dataKeys?: DataKey[];
		emptyMessage?: string;
	}

	let {
		data,
		title = 'Top Investors by Capital',
		dataKeys = [
			{ key: 'capital', label: 'Capital', color: CHART_PALETTE.primary },
			{ key: 'interest', label: 'Interest', color: CHART_PALETTE.teal }
		],
		emptyMessage = 'No investors found'
	}: Props = $props();

	const isEmpty = $derived(!data || data.length === 0);
	const enterMotion = chartEnterMotion();
</script>

{#snippet seriesLegend()}
	<div class="flex flex-wrap items-center gap-3">
		{#each dataKeys as dk (dk.key)}
			<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<span class="size-2 rounded-full" style="background: {dk.color}"></span>
				{dk.label}
			</div>
		{/each}
	</div>
{/snippet}

<ChartShell {title} action={seriesLegend}>
	{#if isEmpty}
		<div class="empty-state-well h-[{CHART_HEIGHT}px] gap-2 text-muted-foreground">
			<TrendingUp class="h-8 w-8 opacity-40" />
			<p class="text-sm">{emptyMessage}</p>
		</div>
	{:else}
		<div class="chart-canvas" style="height: {CHART_HEIGHT}px">
			<BarChart
				{data}
				y="name"
				orientation="horizontal"
				series={dataKeys.map((dk) => ({ key: dk.key, label: dk.label, color: dk.color }))}
				seriesLayout="group"
				bandPadding={0.28}
				groupPadding={0.2}
				axis
				grid
				rule={false}
				legend={false}
				padding={{ left: 120, right: 16, top: 8, bottom: 28 }}
				props={{
					bars: {
						strokeWidth: 0,
						radius: 6,
						rounded: 'edge',
						motion: enterMotion
					},
					grid: {
						stroke: 'var(--border)',
						opacity: 0.7
					},
					xAxis: {
						format: formatChartAxis,
						tickMarks: false,
						tickOcclusion: { padding: 10, priority: 'start-end' }
					},
					yAxis: {
						tickMarks: false,
						tickLabelProps: {
							class: 'text-[11px] fill-muted-foreground'
						}
					},
					tooltip: { root: CHART_TOOLTIP_ROOT }
				}}
			>
				{#snippet tooltip()}
					<Tooltip.Root {...CHART_TOOLTIP_ROOT}>
						{#snippet children({ data: row }: { data: InvestorCapitalRow })}
							<p class="chart-tooltip-title">{row.name}</p>
							<Tooltip.List>
								{#each dataKeys as dk (dk.key)}
									<Tooltip.Item
										label={dk.label}
										value={formatCurrency(row[dk.key as keyof InvestorCapitalRow] as number)}
										color={dk.color}
										valueAlign="right"
									/>
								{/each}
							</Tooltip.List>
						{/snippet}
					</Tooltip.Root>
				{/snippet}
			</BarChart>
		</div>
	{/if}
</ChartShell>
