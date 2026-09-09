<script lang="ts">
	import type { Snippet, Component } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import { getSummaryMetricGridCols } from '$lib/summary-grid';
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
</script>

<div class={cn('grid gap-2.5 sm:gap-3', className ?? getSummaryMetricGridCols(metrics.length))}>
	{#each metrics as metric, index}
		{@const defaults = defaultStyles[index % defaultStyles.length]}
		{@const Icon = metric.icon ?? defaults.icon}
		{@const empty = isMetricEmpty(metric)}
		<Card.Root
			class={cn('group surface-card-interactive border-border/40', empty && 'hidden lg:block')}
		>
			<Card.Content class="p-3">
				<div class="flex items-center justify-between gap-2">
					<p class="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
						{metric.label}
					</p>
					<div
						class={cn('icon-well-sm shrink-0', metric.accentClassName ?? defaults.accentClassName)}
					>
						<Icon class="h-3.5 w-3.5" />
					</div>
				</div>
				<p
					class={cn(
						'mt-1.5 text-base leading-snug font-semibold break-words tabular-nums',
						metric.valueClassName
					)}
				>
					{resolveValue(metric)}
				</p>
				{#if resolveSubValue(metric)}
					<p class="mt-0.5 text-xs leading-snug break-words text-muted-foreground">
						{resolveSubValue(metric)}
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/each}
</div>
