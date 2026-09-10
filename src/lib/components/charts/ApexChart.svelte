<script lang="ts">
	import { browser } from '$app/environment';
	import type { ApexOptions } from 'apexcharts';
	import type ApexCharts from 'apexcharts';
	import { mode } from 'mode-watcher';
	import { cn } from '$lib/utils';
	import { baseApexOptions } from './chart-theme';

	interface Props {
		type: NonNullable<NonNullable<ApexOptions['chart']>['type']>;
		height: number;
		series: NonNullable<ApexOptions['series']>;
		options?: ApexOptions;
		class?: string;
		chart?: ApexCharts | null;
	}

	let {
		type,
		height,
		series,
		options = {},
		class: className,
		chart = $bindable(null)
	}: Props = $props();

	let node = $state<HTMLDivElement | undefined>();
	let ready = $state(false);

	function mergedOptions(): ApexOptions {
		const base = baseApexOptions();
		return {
			...base,
			...options,
			series,
			chart: {
				...base.chart,
				...options.chart,
				type,
				height,
				width: '100%'
			},
			tooltip: {
				...base.tooltip,
				...options.tooltip
			}
		};
	}

	$effect(() => {
		if (!browser || !node) return;
		void mode.current;

		const next = mergedOptions();
		let cancelled = false;
		let local: ApexCharts | null = null;

		void import('apexcharts').then(async ({ default: ApexChartsCtor }) => {
			if (cancelled || !node) return;
			local = new ApexChartsCtor(node, next);
			await local.render();
			if (cancelled) {
				local.destroy();
				return;
			}
			chart = local;
			ready = true;
		});

		return () => {
			cancelled = true;
			ready = false;
			chart = null;
			local?.destroy();
		};
	});
</script>

<div class={cn('chart-canvas relative', className)} style="height: {height}px">
	{#if !ready}
		<div class="absolute inset-0 animate-pulse rounded-2xl bg-muted/40"></div>
	{/if}
	<div bind:this={node} class={cn('h-full w-full', !ready && 'opacity-0')}></div>
</div>
