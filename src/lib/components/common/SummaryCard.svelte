<script lang="ts">
	import type { Component } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import { getOddLastVisibleMobileSpan, getSummaryMetricGridCols } from '$lib/summary-grid';
	import { formatCurrency, formatCount } from '$lib/format';
	import { Wallet, Activity, CheckCircle2, TrendingUp, CircleDollarSign } from 'lucide-svelte';

	export interface MetricItem {
		label: string;
		value?: string;
		amount?: number;
		subValue?: string;
		subCount?: number;
		subCountSuffix?: string;
		subValueTemplate?: string;
		subAmount?: number;
		valueClassName?: string;
		icon?: Component<{ class?: string }>;
		accentClassName?: string;
		empty?: boolean;
	}

	interface Props {
		metrics: MetricItem[];
		class?: string;
	}

	let { metrics, class: className }: Props = $props();

	const defaultStyles = [
		{ icon: Wallet, accentClassName: 'bg-primary/12 text-primary' },
		{ icon: Activity, accentClassName: 'bg-chart-5/15 text-chart-5' },
		{ icon: CheckCircle2, accentClassName: 'bg-chart-4/12 text-chart-4' },
		{ icon: TrendingUp, accentClassName: 'bg-chart-2/12 text-chart-2' },
		{ icon: CircleDollarSign, accentClassName: 'bg-chart-1/12 text-chart-1' }
	];

	function isMetricEmpty(metric: MetricItem) {
		if (metric.empty !== undefined) return metric.empty;
		if (metric.amount !== undefined) return metric.amount === 0;
		return false;
	}

	function resolveValue(metric: MetricItem) {
		if (metric.amount !== undefined) return formatCurrency(metric.amount);
		return metric.value ?? '—';
	}

	function resolveSubValue(metric: MetricItem) {
		if (metric.subValueTemplate && metric.subAmount !== undefined) {
			return metric.subValueTemplate.replace('{amount}', formatCurrency(metric.subAmount));
		}
		if (metric.subCount !== undefined) {
			return `${formatCount(metric.subCount)}${metric.subCountSuffix ?? ''}`;
		}
		return metric.subValue;
	}

	const gridCols = $derived(className ?? getSummaryMetricGridCols(metrics.length));
	const visibleCount = $derived(metrics.filter((m) => !isMetricEmpty(m)).length);
	const lastVisibleIndex = $derived(metrics.findLastIndex((m) => !isMetricEmpty(m)));
</script>

<div class={cn('grid min-w-0 items-stretch gap-2.5 md:gap-5', gridCols)}>
	{#each metrics as metric, index}
		{@const defaults = defaultStyles[index % defaultStyles.length]}
		{@const Icon = metric.icon ?? defaults.icon}
		{@const empty = isMetricEmpty(metric)}
		{@const subValue = resolveSubValue(metric)}
		<Card.Root
			class={cn(
				'group flex h-full min-w-0 surface-card-interactive border-border/40',
				empty && 'hidden lg:block',
				getOddLastVisibleMobileSpan({
					empty,
					isLastVisible: index === lastVisibleIndex,
					visibleCount,
					gridClass: gridCols
				})
			)}
		>
			<Card.Content
				class={cn(
					'flex h-full w-full min-w-0 flex-col gap-1 p-3 md:p-5',
					subValue && 'min-h-28 md:min-h-[7.5rem]'
				)}
			>
				<div class="flex items-center justify-between gap-2">
					<p class="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
						{metric.label}
					</p>
					<div
						class={cn(
							'icon-well-sm shrink-0 transition-transform duration-300 group-hover:scale-105',
							metric.accentClassName ?? defaults.accentClassName
						)}
					>
						<Icon class="h-3 w-3" />
					</div>
				</div>
				<p
					class={cn(
						'text-[15px] leading-snug font-semibold break-words tabular-nums lg:text-lg',
						metric.valueClassName
					)}
				>
					{resolveValue(metric)}
				</p>
				{#if subValue}
					<p
						class="mt-auto text-xs leading-relaxed break-words text-muted-foreground lg:text-sm"
					>
						{subValue}
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/each}
</div>
