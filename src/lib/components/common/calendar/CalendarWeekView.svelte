<script lang="ts">
	import DailySummary from './DailySummary.svelte';
	import type { CalendarCell, CalendarConfig } from './types';

	interface Props {
		cells: CalendarCell[];
		config: CalendarConfig;
		dayNames: string[];
		isToday: (date: Date) => boolean;
	}

	let { cells, config, dayNames, isToday }: Props = $props();
</script>

<div class="w-full min-w-0">
	<div class="grid grid-cols-7 border-b bg-muted/30">
		{#each cells as cell, index (index)}
			<div
				class="min-w-0 border-r p-1 text-center last:border-r-0 lg:p-2 xl:p-3 {isToday(cell.date)
					? 'bg-primary/5'
					: ''}"
			>
				<div class="text-[10px] font-semibold text-muted-foreground lg:text-xs">
					<span class="hidden xl:inline">{dayNames[cell.date.getDay()]}</span>
					<span class="inline xl:hidden">{dayNames[cell.date.getDay()].slice(0, 3)}</span>
				</div>
					<div
						class="mt-1 text-lg font-semibold md:text-xl {isToday(cell.date)
							? 'mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary/80 ring-1 ring-primary/20 md:h-9 md:w-9'
							: ''}"
					>
						{cell.date.getDate()}
					</div>
					{#if isToday(cell.date)}
						<span
							class="rounded bg-primary/15 px-1.5 py-0.5 text-[8px] font-semibold text-primary/80 uppercase md:text-[9px]"
						>
							Today
						</span>
					{/if}
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-7">
		{#each cells as cell, index (index)}
			<div
				class="relative min-h-[12rem] min-w-0 border-r p-1 last:border-r-0 sm:min-h-[14rem] sm:p-1.5 lg:min-h-[18rem] lg:p-2 xl:min-h-[25rem] {!cell.isCurrentMonth
					? 'bg-muted/30'
					: ''} {isToday(cell.date) ? 'bg-primary/5' : ''}"
			>
				<div class="min-w-0 space-y-2">
						<DailySummary
							events={cell.events}
							formatCurrency={config.formatCurrency}
							size="sm"
							alwaysShow={config.alwaysShowSummary}
						/>

						{#if config.eventCard}
							{#each cell.events as event, eventIndex (eventIndex)}
								{@render config.eventCard(event, eventIndex)}
							{/each}
						{/if}
					</div>
				</div>
		{/each}
	</div>
</div>
