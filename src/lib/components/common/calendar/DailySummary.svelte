<script lang="ts">
	import type {
		CalendarEvent,
		CalendarEventDue,
		CalendarEventInterestDue,
		CalendarEventSent,
		CalendarEventTransaction
	} from './types';

	interface Props {
		events: CalendarEvent[];
		formatCurrency: (amount: number) => string;
		size?: 'sm' | 'md' | 'lg';
		alwaysShow?: boolean;
	}

	let { events, formatCurrency, size = 'md', alwaysShow = false }: Props = $props();

	const totalOut = $derived(
		events.reduce((sum, e) => {
			if (e.type === 'sent') {
				return sum + (e as CalendarEventSent).totalAmount;
			}
			if (e.type === 'transaction') {
				const txEvent = e as CalendarEventTransaction;
				return txEvent.direction === 'Out' ? sum + txEvent.amount : sum;
			}
			return sum;
		}, 0)
	);

	const totalIn = $derived(
		events.reduce((sum, e) => {
			if (e.type === 'due') {
				return sum + (e as CalendarEventDue).totalAmount;
			}
			if (e.type === 'interest_due') {
				return sum + (e as CalendarEventInterestDue).totalAmount;
			}
			if (e.type === 'transaction') {
				const txEvent = e as CalendarEventTransaction;
				return txEvent.direction === 'In' ? sum + txEvent.amount : sum;
			}
			return sum;
		}, 0)
	);

	const hasActivity = $derived(totalOut > 0 || totalIn > 0);
	const showSummary = $derived(alwaysShow || (events.length > 1 && hasActivity));

	const sizeClasses = {
		sm: {
			container: 'p-1.5 text-[10px] space-y-0.5',
			text: 'text-[10px]'
		},
		md: {
			container: 'p-2 text-xs space-y-1',
			text: 'text-xs'
		},
		lg: {
			container: 'p-3 text-sm space-y-1',
			text: 'text-sm'
		}
	};

	const classes = $derived(sizeClasses[size]);
</script>

{#if showSummary}
	<div class="mb-2 rounded border border-border bg-muted/30 {classes.container}">
		{#if totalOut > 0}
			<div class="flex items-center justify-between">
				<span class="font-semibold text-rose-600 dark:text-rose-400">
					{size === 'lg' ? 'Total Out:' : 'Out:'}
				</span>
				<span class="font-bold text-rose-700 dark:text-rose-400 {size === 'lg' ? 'text-lg' : ''}">
					-{formatCurrency(totalOut)}
				</span>
			</div>
		{/if}
		{#if totalIn > 0}
			<div class="flex items-center justify-between">
				<span class="font-semibold text-emerald-600 dark:text-emerald-400">
					{size === 'lg' ? 'Total In:' : 'In:'}
				</span>
				<span
					class="font-bold text-emerald-700 dark:text-emerald-400 {size === 'lg' ? 'text-lg' : ''}"
				>
					+{formatCurrency(totalIn)}
				</span>
			</div>
		{/if}
		{#if totalOut > 0 && totalIn > 0}
			<div
				class="flex items-center justify-between border-t border-border {size === 'lg'
					? 'pt-2'
					: 'pt-0.5'}"
			>
				<span class="font-semibold text-foreground">Net:</span>
				<span
					class="font-bold {totalIn - totalOut >= 0
						? 'text-emerald-700 dark:text-emerald-400'
						: 'text-rose-700 dark:text-rose-400'} {size === 'lg' ? 'text-lg' : ''}"
				>
					{formatCurrency(totalIn - totalOut)}
				</span>
			</div>
		{/if}
	</div>
{/if}
