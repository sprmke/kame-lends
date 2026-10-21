<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import { formatCurrencyCompact, formatText, isSensitiveDataHidden } from '$lib/format';
	import LoanStatusBadge from '$lib/components/loans/LoanStatusBadge.svelte';
	import {
		buildLoanTimeline,
		localDayKey,
		timelineDayParts,
		type TimelineEntry
	} from '$lib/loans/loan-timeline';
	import type { LoanWithInvestors } from '$lib/types';
	import { cn } from '$lib/utils';
	import { ArrowDown, ArrowUp, GanttChart } from 'lucide-svelte';

	interface Props {
		loans: LoanWithInvestors[];
		from?: string | null;
		to?: string | null;
		onLoanClick?: (loan: LoanWithInvestors) => void;
	}

	let { loans, from = null, to = null, onLoanClick }: Props = $props();

	let today = $state<Date | null>(typeof window !== 'undefined' ? new Date() : null);
	let todayEl = $state<HTMLElement | null>(null);
	let showJump = $state(false);
	/** Where today sits relative to the viewport while off screen. */
	let todayDirection = $state<'up' | 'down'>('down');
	let reduceMotion = $state(
		typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
	let scrolledTimelineKey = '';

	onMount(() => {
		today = new Date();
	});

	const timeline = $derived(buildLoanTimeline(loans, { from, to, today }));

	$effect(() => {
		const rangeKey = `${from ?? ''}:${to ?? ''}`;
		const monthKey = today ? localDayKey(today).slice(0, 7) : null;
		const hasCurrentMonth = timeline.months.some((month) => month.key === monthKey);
		if (!monthKey || timeline.months.length < 2 || !hasCurrentMonth) return;
		if (scrolledTimelineKey === rangeKey) return;
		if (typeof document === 'undefined') return;
		scrolledTimelineKey = rangeKey;
		const behavior = reduceMotion ? 'auto' : 'smooth';
		requestAnimationFrame(() => {
			document.getElementById(`timeline-month-${monthKey}`)?.scrollIntoView({
				block: 'start',
				behavior
			});
		});
	});

	function money(amount: number, sign: '+' | '-' | 'auto' = 'auto'): string {
		const formatted = formatCurrencyCompact(sign === '-' ? -Math.abs(amount) : amount);
		if (isSensitiveDataHidden() || sign === 'auto' || amount === 0) return formatted;
		if (sign === '+') return `+${formatted}`;
		return formatted;
	}

	function netAmount(inTotal: number, outTotal: number): number {
		return inTotal - outTotal;
	}

	function netClass(net: number): string {
		if (isSensitiveDataHidden() || net === 0) return 'text-foreground';
		return net > 0
			? 'text-emerald-600 dark:text-emerald-400'
			: 'text-rose-600 dark:text-rose-400';
	}

	function flowAria(inTotal: number, outTotal: number): string {
		const net = netAmount(inTotal, outTotal);
		const parts: string[] = [];
		if (inTotal > 0) parts.push(`In ${money(inTotal, '+')}`);
		if (outTotal > 0) parts.push(`Out ${money(outTotal, '-')}`);
		if (inTotal > 0 && outTotal > 0) {
			parts.push(`Net ${money(net, net > 0 ? '+' : 'auto')}`);
		}
		return parts.join(', ');
	}

	function entryLabel(entry: TimelineEntry): string {
		const detail = entry.detail ? `, ${entry.detail}` : '';
		return `${entry.direction === 'in' ? 'In' : 'Out'}, ${entry.kindLabel}, ${entry.title}${detail}, ${formatText(entry.loan.status)}, ${money(entry.amount)}`;
	}

	function markToday(node: HTMLElement, active: boolean) {
		if (active) todayEl = node;
		return {
			update(next: boolean) {
				if (next) todayEl = node;
				else if (todayEl === node) todayEl = null;
			},
			destroy() {
				if (todayEl === node) todayEl = null;
			}
		};
	}

	function jumpToToday() {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		todayEl?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
	}

	$effect(() => {
		const el = todayEl;
		if (!el) {
			showJump = false;
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				showJump = entry ? !entry.isIntersecting : false;
				if (entry && !entry.isIntersecting) {
					todayDirection = entry.boundingClientRect.top < 0 ? 'up' : 'down';
				}
			},
			{ root: null, rootMargin: '-88px 0px -120px 0px', threshold: 0.35 }
		);
		observer.observe(el);
		return () => observer.disconnect();
	});
</script>

{#snippet flowTotals(
	inTotal: number,
	outTotal: number,
	emphasis: 'month' | 'day' = 'day',
	align: 'start' | 'end' = 'end'
)}
	{@const net = netAmount(inTotal, outTotal)}
	{@const hasFlow = inTotal > 0 || outTotal > 0}
	{#if hasFlow}
		{@const showNet = inTotal > 0 && outTotal > 0}
		{@const alignClass =
			emphasis === 'month'
				? 'justify-start text-left lg:justify-end lg:text-right'
				: align === 'start'
					? 'justify-start text-left'
					: 'justify-end text-right'}
		<p
			class={cn(
				'flex w-full min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums',
				alignClass,
				emphasis === 'month' ? 'text-xs sm:text-sm' : 'text-sm'
			)}
			aria-label={flowAria(inTotal, outTotal)}
		>
			{#if inTotal > 0}
				<span class="font-medium text-emerald-600 dark:text-emerald-400">
					In {money(inTotal, '+')}
				</span>
			{/if}
			{#if outTotal > 0}
				<span class="font-medium text-rose-600 dark:text-rose-400">
					Out {money(outTotal, '-')}
				</span>
			{/if}
			{#if showNet}
				<span class={cn('font-semibold', netClass(net))}>
					Net {money(net, net > 0 ? '+' : 'auto')}
				</span>
			{/if}
		</p>
	{/if}
{/snippet}

{#snippet movement(entry: TimelineEntry, grouped: boolean)}
	<button
		type="button"
		class={cn(
			'flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left active:bg-muted/60',
			grouped ? 'bg-transparent' : 'rounded-2xl border border-border/60 bg-card'
		)}
		aria-label={entryLabel(entry)}
		onclick={() => onLoanClick?.(entry.loan)}
	>
		<span
			class={cn(
				'w-11 shrink-0 text-[11px] font-semibold uppercase tracking-wide sm:w-12 sm:text-xs',
				entry.direction === 'in'
					? 'text-emerald-600 dark:text-emerald-400'
					: entry.kind === 'scheduled'
						? 'text-amber-600 dark:text-amber-400'
						: 'text-rose-600 dark:text-rose-400'
			)}
		>
			{entry.direction === 'in' ? 'In' : 'Out'}
		</span>
		<span class="min-w-0 flex-1">
			<span class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
				<span class="max-w-full truncate text-sm font-medium text-foreground">
					{formatText(entry.title)}
				</span>
				<LoanStatusBadge status={entry.loan.status} />
			</span>
			<span class="mt-0.5 block truncate text-xs text-muted-foreground">
				{entry.kindLabel}{#if entry.detail}
					· {formatText(entry.detail)}{/if}
			</span>
		</span>
		<span
			class={cn(
				'shrink-0 text-sm font-semibold tabular-nums',
				entry.direction === 'in'
					? 'text-emerald-600 dark:text-emerald-400'
					: entry.kind === 'scheduled'
						? 'text-amber-600 dark:text-amber-400'
						: 'text-rose-600 dark:text-rose-400'
			)}
		>
			{entry.direction === 'in' ? money(entry.amount, '+') : money(entry.amount, '-')}
		</span>
	</button>
{/snippet}

{#if timeline.months.length === 0}
	<ListEmptyState message="No activity in this range" icon={GanttChart} />
{:else}
	<div class="loan-timeline flex w-full min-w-0 flex-col gap-7">
		{#each timeline.months as month (month.key)}
			<section id="timeline-month-{month.key}" class="w-full min-w-0 scroll-mt-24">
				<header
					class="timeline-month-header sticky top-[calc(var(--mobile-top-bar-height)+var(--safe-area-top))] z-30 w-full min-w-0 border-b border-border/60 bg-background py-3 lg:top-0"
				>
					<div class="grid w-full grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2">
						<div
							class="flex w-11 items-center justify-center text-muted-foreground"
							aria-hidden="true"
						>
							<GanttChart class="h-5 w-5" />
						</div>
						<div class="min-w-0 space-y-1 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:space-y-0">
							<h2 class="text-sm font-semibold tracking-tight">{month.label}</h2>
							{@render flowTotals(month.inTotal, month.outTotal, 'month')}
						</div>
					</div>
				</header>

				<div class="relative mt-3">
					<div
						class="pointer-events-none absolute top-0 bottom-0 left-[1.375rem] w-px -translate-x-1/2 bg-border/60"
						aria-hidden="true"
					></div>
					{#each month.days as day (day.dateKey)}
						{@const parts = timelineDayParts(day.dateKey)}
						{@const showDayTotals = day.entries.length > 1}
						<article
							id="timeline-day-{day.dateKey}"
							class="timeline-day flex gap-2 pb-6"
							use:markToday={day.isToday}
						>
							<div
								class={cn(
									'relative z-10 flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-transparent bg-background',
									day.isToday && 'border-primary/20 bg-primary text-primary-foreground'
								)}
								aria-current={day.isToday ? 'date' : undefined}
							>
								<span class="text-sm font-semibold leading-none tabular-nums">{parts.day}</span>
								<span
									class={cn(
										'mt-0.5 text-[10px] leading-none font-medium uppercase',
										day.isToday ? 'text-primary-foreground/85' : 'text-muted-foreground'
									)}
								>
									{parts.weekday}
								</span>
							</div>

							<div class="min-w-0 flex-1">
								{#if day.entries.length === 0}
									<div
										class="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5"
										aria-label="Today, no activity"
									>
										<span class="w-11 shrink-0 sm:w-12" aria-hidden="true"></span>
										<span class="min-w-0 flex-1 text-sm text-muted-foreground">No activity</span>
									</div>
								{:else if showDayTotals}
									<div class="overflow-hidden rounded-2xl border border-border/60 bg-card">
										<ul class="divide-y divide-border/50">
											{#each day.entries as entry (entry.id)}
												<li>{@render movement(entry, true)}</li>
											{/each}
										</ul>
										<div class="border-t border-border/50 px-3 py-2">
											{@render flowTotals(day.inTotal, day.outTotal, 'day')}
										</div>
									</div>
								{:else if day.entries[0]}
									{@render movement(day.entries[0], false)}
								{/if}
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}

{#if showJump}
	{@const Arrow = todayDirection === 'up' ? ArrowUp : ArrowDown}
	<button
		type="button"
		class="fixed left-1/2 z-30 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-card py-1.5 pr-4 pl-1.5 text-sm font-medium text-foreground shadow-[var(--shadow-native-float)] transition-transform active:scale-95 bottom-[calc(var(--mobile-dock-clearance)+var(--safe-area-bottom)+0.75rem)] lg:bottom-6"
		aria-label="Jump to today"
		onclick={jumpToToday}
		transition:fly={{ y: 12, duration: reduceMotion ? 0 : 180 }}
	>
		<span class="grid size-8 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
			<Arrow class="size-4" />
		</span>
		Today
	</button>
{/if}

<style>
	.timeline-day {
		scroll-margin-top: calc(var(--mobile-top-bar-height) + var(--safe-area-top) + 4.5rem);
	}

	@media (min-width: 1024px) {
		.timeline-day {
			scroll-margin-top: 4.5rem;
		}
	}
</style>
