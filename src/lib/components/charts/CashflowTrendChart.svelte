<script lang="ts">
	import type { ApexOptions } from 'apexcharts';
	import type ApexCharts from 'apexcharts';
	import { Button } from '$lib/components/ui/button';
	import ChartShell from './ChartShell.svelte';
	import ApexChart from './ApexChart.svelte';
	import { CHART_HEIGHT, chartPalette, tooltipCard } from './chart-theme';
	import { formatChartAxis, formatCurrency } from '$lib/format';
	import { cn } from '$lib/utils';
	import { TrendingUp } from 'lucide-svelte';
	import { mode } from 'mode-watcher';
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
	let chart = $state<ApexCharts | null>(null);
	let hidden = $state(new Set<string>());

	const seriesMeta = $derived.by(() => {
		void mode.current;
		const palette = chartPalette();
		return [
			{ key: 'inflow' as const, label: 'Inflow', color: palette.teal, dash: 0 },
			{ key: 'outflow' as const, label: 'Outflow', color: palette.coral, dash: 0 },
			{ key: 'net' as const, label: 'Net', color: palette.primary, dash: 6 }
		];
	});

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

	const series = $derived(
		seriesMeta.map((item) => ({
			name: item.label,
			type: item.key === 'net' ? 'line' : 'area',
			data: data.map((row) => row[item.key])
		}))
	);

	const options = $derived<ApexOptions>({
		colors: seriesMeta.map((item) => item.color),
		stroke: {
			curve: 'smooth',
			width: [2.5, 2.5, 3],
			dashArray: seriesMeta.map((item) => item.dash)
		},
		fill: {
			type: ['gradient', 'gradient', 'solid'],
			gradient: {
				shadeIntensity: 0.15,
				opacityFrom: 0.28,
				opacityTo: 0.02,
				stops: [0, 90, 100]
			}
		},
		markers: {
			size: 0,
			strokeWidth: 2,
			strokeColors: 'var(--card)',
			hover: { size: 5 }
		},
		grid: {
			borderColor: 'var(--border)',
			strokeDashArray: 4,
			xaxis: { lines: { show: false } },
			yaxis: { lines: { show: true } },
			padding: { top: 12, right: 8, left: 4, bottom: 0 }
		},
		xaxis: {
			categories: data.map((row) => row.label),
			tickAmount: Math.min(6, Math.max(2, data.length - 1)),
			labels: {
				style: { colors: 'var(--muted-foreground)', fontSize: '11px' },
				hideOverlappingLabels: true
			}
		},
		yaxis: {
			labels: {
				formatter: (value) => formatChartAxis(value),
				style: { colors: 'var(--muted-foreground)', fontSize: '11px' }
			}
		},
		tooltip: {
			shared: true,
			intersect: false,
			custom({ dataPointIndex }) {
				const row = data[dataPointIndex];
				if (!row) return '';
				return tooltipCard(
					row.label,
					seriesMeta.map((item) => ({
						label: item.label,
						value: formatCurrency(row[item.key]),
						color: item.color
					}))
				);
			}
		}
	});

	function toggleSeries(name: string) {
		if (!chart) return;
		if (hidden.has(name)) {
			void chart.showSeries(name);
			hidden.delete(name);
		} else {
			void chart.hideSeries(name);
			hidden.add(name);
		}
		hidden = new Set(hidden);
	}
</script>

{#snippet headerActions()}
	<div class="flex flex-wrap items-center justify-end gap-3">
		<div class="hidden items-center gap-1 sm:flex">
			{#each seriesMeta as item (item.key)}
				<button
					type="button"
					class={cn(
						'flex min-h-11 items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-muted-foreground transition-opacity duration-200',
						hidden.has(item.label) && 'opacity-40'
					)}
					onclick={() => toggleSeries(item.label)}
				>
					<span
						class="size-2 rounded-full"
						style="background: {item.color}; {item.dash
							? 'box-shadow: inset 0 0 0 1px color-mix(in oklab, white 35%, transparent)'
							: ''}"
					></span>
					{item.label}
				</button>
			{/each}
		</div>
		<div class="pill-segment self-start">
			{#each ['day', 'week', 'month'] as p}
				<Button
					variant={period === p ? 'secondary' : 'ghost'}
					size="sm"
					class={cn(
						'h-8 rounded-xl px-3.5 text-xs font-medium',
						period === p && 'bg-muted text-foreground shadow-none'
					)}
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
		<ApexChart type="line" height={CHART_HEIGHT} {series} {options} bind:chart />
		<ul class="sr-only">
			{#each data as row (row.label)}
				<li>
					{row.label}: inflow {formatCurrency(row.inflow)}, outflow {formatCurrency(row.outflow)},
					net {formatCurrency(row.net)}
				</li>
			{/each}
		</ul>
	{/if}
</ChartShell>
