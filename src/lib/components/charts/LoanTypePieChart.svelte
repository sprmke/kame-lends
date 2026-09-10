<script lang="ts">
	import ChartShell from './ChartShell.svelte';
	import {
		DONUT_PATH,
		DONUT_STROKE,
		PIE_SIZE,
		donutArcs,
		sliceColor
	} from './chart-theme';
	import { formatCount } from '$lib/format';
	import { cn } from '$lib/utils';
	import { PieChart as PieIcon } from 'lucide-svelte';
	import { mode } from 'mode-watcher';
	import type { ChartSlice } from '$lib/server/dashboard-data';

	interface Props {
		data: ChartSlice[];
		title?: string;
		emptyMessage?: string;
	}

	let { data, title = 'Distribution', emptyMessage = 'No data found' }: Props = $props();

	const chartData = $derived.by(() => {
		void mode.current;
		return data
			.filter((slice) => slice.value > 0)
			.map((slice, index) => ({ ...slice, color: sliceColor(slice.name, index) }));
	});
	const isEmpty = $derived(!chartData.length);
	const total = $derived(chartData.reduce((sum, slice) => sum + slice.value, 0));
	const arcs = $derived(donutArcs(chartData, total));
	let hoveredIndex = $state<number | null>(null);

	const activeSlice = $derived(hoveredIndex === null ? null : (chartData[hoveredIndex] ?? null));

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
		<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
			<div class="chart-donut relative size-60 shrink-0">
				<svg
					class="chart-donut-svg size-60"
					viewBox="0 0 {PIE_SIZE} {PIE_SIZE}"
					role="img"
					aria-hidden="true"
				>
					{#each arcs as arc (arc.name)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<path
							class={cn(
								'chart-donut-arc',
								hoveredIndex !== null && hoveredIndex !== arc.index && 'is-dim'
							)}
							d={DONUT_PATH}
							fill="none"
							stroke={arc.color}
							stroke-width={DONUT_STROKE}
							stroke-dasharray="{arc.length} {arc.remainder}"
							stroke-dashoffset={-arc.offset}
							stroke-linecap="butt"
							onpointerenter={() => (hoveredIndex = arc.index)}
							onpointerleave={() => (hoveredIndex = null)}
						/>
					{/each}
				</svg>
				<div
					class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
				>
					<p class="text-xl font-semibold tracking-tight tabular-nums">
						{formatCount(activeSlice ? activeSlice.value : total)}
					</p>
					<p class="mt-0.5 max-w-28 truncate text-[11px] text-muted-foreground">
						{activeSlice ? activeSlice.name : 'loans'}
					</p>
				</div>
			</div>

			<ul class="w-full min-w-0 flex-1 space-y-1.5">
				{#each chartData as slice, index (slice.name)}
					<li>
						<button
							type="button"
							class={cn(
								'flex w-full min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-opacity duration-200',
								hoveredIndex !== null && hoveredIndex !== index && 'opacity-40'
							)}
							onpointerenter={() => (hoveredIndex = index)}
							onpointerleave={() => (hoveredIndex = null)}
							onfocus={() => (hoveredIndex = index)}
							onblur={() => (hoveredIndex = null)}
						>
							<span class="size-2.5 shrink-0 rounded-full" style="background: {slice.color}"></span>
							<span class="min-w-0 flex-1 truncate text-sm">{slice.name}</span>
							<span class="text-sm font-medium tabular-nums">{formatCount(slice.value)}</span>
							<span class="w-10 text-right text-xs text-muted-foreground tabular-nums"
								>{percent(slice.value)}%</span
							>
						</button>
					</li>
				{/each}
			</ul>
		</div>
		<ul class="sr-only">
			{#each chartData as slice (slice.name)}
				<li>{slice.name}: {formatCount(slice.value)} ({percent(slice.value)}%)</li>
			{/each}
		</ul>
	{/if}
</ChartShell>
