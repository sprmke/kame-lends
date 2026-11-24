<script lang="ts">
	import type { ChartPoint } from '$lib/assistant/types';
	import { formatPHP } from '$lib/money/centavos';
	import { maskPrices } from '$lib/assistant/price';

	interface Props {
		title: string;
		points: ChartPoint[];
		note?: string;
	}

	let { title, points, note }: Props = $props();
	const max = $derived(
		Math.max(1, ...points.flatMap((point) => [point.inflowC, point.outflowC]))
	);
</script>

<div class="rounded-xl border border-border/60 bg-card p-3">
	<div class="mb-2 flex items-center justify-between gap-2">
		<p class="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
		<div class="flex items-center gap-2 text-[9.5px] text-muted-foreground">
			<span class="inline-flex items-center gap-1"><span class="size-2 rounded-sm bg-primary"></span>In</span>
			<span class="inline-flex items-center gap-1"><span class="size-2 rounded-sm bg-amber-500"></span>Out</span>
		</div>
	</div>
	<div class="space-y-2" role="img" aria-label={`${title}: inflow and outflow by period`}>
		{#each points as point (point.label)}
			<div>
				<div class="mb-0.5 flex items-center justify-between text-[10px]">
					<span class="font-medium">{point.label}</span>
					<span class="tabular-nums text-muted-foreground">
						{maskPrices(`net ${formatPHP(point.inflowC - point.outflowC)}`)}
					</span>
				</div>
				<div class="flex gap-1">
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
						<div class="h-full rounded-full bg-primary" style={`width:${(point.inflowC / max) * 100}%`}></div>
					</div>
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
						<div class="h-full rounded-full bg-amber-500" style={`width:${(point.outflowC / max) * 100}%`}></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
	{#if note}<p class="mt-2 text-[10px] text-muted-foreground">{note}</p>{/if}
</div>
