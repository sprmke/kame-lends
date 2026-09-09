<script lang="ts">
	import { PieChart, Text, Tooltip, type ChartState } from 'layerchart';
	import ChartShell from './ChartShell.svelte';
	import { CHART_TOOLTIP_ROOT, PIE_SIZE, chartEnterMotion } from './chart-theme';
	import { formatCount } from '$lib/format';
	import { cn } from '$lib/utils';
	import { PieChart as PieIcon } from 'lucide-svelte';
	import type { ChartSlice } from '$lib/server/dashboard-data';

	interface Props {
		data: ChartSlice[];
		title?: string;
		emptyMessage?: string;
	}

	let { data, title = 'Distribution', emptyMessage = 'No data found' }: Props = $props();

	const chartData = $derived(
		data.map((d) => ({
			key: d.name,
			label: d.name,
			value: d.value,
			color: d.color
		}))
	);

	const isEmpty = $derived(!chartData.length || chartData.every((d) => d.value === 0));
	const total = $derived(chartData.reduce((sum, d) => sum + d.value, 0));
	const enterMotion = chartEnterMotion();

	let pieContext = $state<ChartState | undefined>();
	let hoveredKey = $state<string | null>(null);

	function setHighlight(key: string | null) {
		hoveredKey = key;
		if (pieContext) pieContext.series.highlightKey = key;
	}

	function percent(value: number): number {
		if (!total) return 0;
		return Math.round((value / total) * 100);
	}
</script>

<ChartShell {title}>
	{#if isEmpty}
		<div class="empty-state-well h-[{PIE_SIZE}px] gap-2 text-muted-foreground">
			<PieIcon class="h-8 w-8 opacity-40" />
			<p class="text-sm">{emptyMessage}</p>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
			<div class="chart-canvas size-[220px] shrink-0">
				<PieChart
					bind:context={pieContext}
					data={chartData}
					key="key"
					label="label"
					value="value"
					c="color"
					innerRadius={0.64}
					cornerRadius={8}
					padAngle={0.025}
					legend={false}
					labels={false}
					props={{
						pie: { motion: enterMotion },
						arc: {
							motion: enterMotion,
							strokeWidth: 0,
							class: 'cursor-pointer'
						},
						tooltip: { root: CHART_TOOLTIP_ROOT }
					}}
				>
					{#snippet aboveMarks()}
						<Text
							value={formatCount(total)}
							textAnchor="middle"
							verticalAnchor="middle"
							class="fill-foreground text-2xl font-semibold tracking-tight"
							dy={-6}
						/>
						<Text
							value="loans"
							textAnchor="middle"
							verticalAnchor="middle"
							class="fill-muted-foreground text-[11px]"
							dy={16}
						/>
					{/snippet}
					{#snippet tooltip()}
						<Tooltip.Root {...CHART_TOOLTIP_ROOT}>
							{#snippet children({ data: row }: { data: (typeof chartData)[number] })}
								<Tooltip.List>
									<Tooltip.Item
										label={row.label}
										value="{formatCount(row.value)} ({percent(row.value)}%)"
										color={row.color}
										valueAlign="right"
									/>
								</Tooltip.List>
							{/snippet}
						</Tooltip.Root>
					{/snippet}
				</PieChart>
			</div>

			<ul class="w-full min-w-0 flex-1 space-y-1">
				{#each chartData as slice (slice.key)}
					<li>
						<button
							type="button"
							class={cn(
								'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-opacity duration-200',
								hoveredKey && hoveredKey !== slice.key && 'opacity-40'
							)}
							onpointerenter={() => setHighlight(slice.key)}
							onpointerleave={() => setHighlight(null)}
							onfocus={() => setHighlight(slice.key)}
							onblur={() => setHighlight(null)}
						>
							<span class="size-2.5 shrink-0 rounded-full" style="background: {slice.color}"></span>
							<span class="min-w-0 flex-1 truncate text-sm">{slice.label}</span>
							<span class="text-sm font-medium tabular-nums">{formatCount(slice.value)}</span>
							<span class="w-10 text-right text-xs text-muted-foreground tabular-nums"
								>{percent(slice.value)}%</span
							>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</ChartShell>
