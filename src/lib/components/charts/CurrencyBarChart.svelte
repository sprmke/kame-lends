<script lang="ts">
	import ChartShell from './ChartShell.svelte';
	import { barChartHeight, chartPalette } from './chart-theme';
	import { formatChartAxis, formatCurrency } from '$lib/format';
	import { cn } from '$lib/utils';
	import { TrendingUp } from 'lucide-svelte';
	import { mode } from 'mode-watcher';
	import type { InvestorCapitalRow } from '$lib/server/dashboard-data';

	interface DataKey {
		key: 'capital' | 'interest';
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
		dataKeys,
		emptyMessage = 'No investors found'
	}: Props = $props();

	let hidden = $state(new Set<string>());
	let hovered = $state<string | null>(null);

	const palette = $derived.by(() => {
		void mode.current;
		return chartPalette();
	});
	const keys = $derived(
		dataKeys ?? [
			{ key: 'capital' as const, label: 'Capital', color: palette.primary },
			{ key: 'interest' as const, label: 'Interest', color: palette.teal }
		]
	);
	const isEmpty = $derived(!data || data.length === 0);
	const ranked = $derived(data ?? []);
	const visibleKeys = $derived(keys.filter((item) => !hidden.has(item.label)));
	const maxValue = $derived(
		Math.max(
			1,
			...ranked.flatMap((row) => visibleKeys.map((item) => Number(row[item.key]) || 0))
		)
	);
	const height = $derived(barChartHeight(ranked.length));

	function toggleSeries(name: string) {
		if (hidden.has(name)) hidden.delete(name);
		else hidden.add(name);
		hidden = new Set(hidden);
	}

	function widthPercent(value: number): number {
		if (value <= 0) return 0;
		return Math.max(1.25, Math.min(100, (value / maxValue) * 100));
	}
</script>

{#snippet seriesLegend()}
	<div class="flex flex-wrap items-center gap-1">
		{#each keys as item (item.key)}
			<button
				type="button"
				class={cn(
					'flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-muted-foreground transition-opacity duration-200',
					hidden.has(item.label) && 'opacity-40'
				)}
				onclick={() => toggleSeries(item.label)}
			>
				<span class="size-2.5 rounded-full" style="background: {item.color}"></span>
				{item.label}
			</button>
		{/each}
	</div>
{/snippet}

<ChartShell {title} action={seriesLegend}>
	{#if isEmpty}
		<div class="empty-state-well gap-2 text-muted-foreground" style="height: {height}px">
			<TrendingUp class="h-8 w-8 opacity-40" />
			<p class="text-sm">{emptyMessage}</p>
		</div>
	{:else}
		<ul class="space-y-4">
			{#each ranked as row, rowIndex (row.name)}
				<li
					class={cn(
						'rounded-2xl transition-opacity duration-200',
						hovered && hovered !== row.name && 'opacity-40'
					)}
					onpointerenter={() => (hovered = row.name)}
					onpointerleave={() => (hovered = null)}
				>
					<p class="truncate text-sm font-medium" title={row.name}>{row.name}</p>
					<div class="mt-2 space-y-1.5">
						{#each visibleKeys as item, seriesIndex (item.key)}
							{@const value = Number(row[item.key]) || 0}
							<div class="flex items-center gap-2.5">
								<div
									class="h-3 min-w-0 flex-1 rounded-full bg-muted/45"
									title="{item.label} {formatCurrency(value)}"
								>
									<div
										class="chart-track-fill h-full rounded-full"
										style="--track: {item.color}; width: {widthPercent(value)}%; animation-delay: {rowIndex *
											70 +
											seriesIndex * 40}ms"
									></div>
								</div>
								<span class="w-19 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
									>{formatChartAxis(value)}</span
								>
							</div>
						{/each}
					</div>
					<span class="sr-only">
						{row.name}: capital {formatCurrency(row.capital)}, interest {formatCurrency(
							row.interest
						)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</ChartShell>
