<script lang="ts">
	import DailySummary from './DailySummary.svelte';
	import type { CalendarCell, CalendarConfig } from './types';

	interface Props {
		cells: CalendarCell[];
		config: CalendarConfig;
	}

	let { cells, config }: Props = $props();

	function isToday(date: Date) {
		const today = new Date();
		return (
			date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear()
		);
	}
</script>

<div class="p-2 md:p-3">
	{#each cells as cell, index (index)}
		<div class="space-y-3 {isToday(cell.date) ? 'rounded-lg bg-primary/5 p-3' : ''}">
			{#if isToday(cell.date)}
				<div class="mb-3 flex items-center gap-2">
					<span
						class="inline-flex items-center rounded bg-primary/15 px-3 py-1 text-[10px] font-semibold text-primary/80 uppercase"
					>
						Today
					</span>
				</div>
			{/if}

			<DailySummary
				events={cell.events}
				formatCurrency={config.formatCurrency}
				alwaysShow={config.alwaysShowSummary}
			/>

			<div class="space-y-2 md:space-y-3">
				{#if cell.events.length === 0}
					<div class="py-8 text-center text-sm text-muted-foreground md:py-12 md:text-base">
						No transactions on this day
					</div>
				{:else if config.eventCard}
					{#each cell.events as event, eventIndex (eventIndex)}
						{@render config.eventCard(event, eventIndex)}
					{/each}
				{/if}
			</div>
		</div>
	{/each}
</div>
