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

<div class="overflow-x-auto">
	<div class="min-w-[1200px]">
		<div class="grid grid-cols-7 border-b bg-gray-50">
			{#each cells as cell, index (index)}
				<div
					class="border-r p-2 text-center last:border-r-0 md:p-3 {isToday(cell.date)
						? 'bg-primary/10'
						: ''}"
				>
					<div class="text-xs font-semibold text-muted-foreground">
						<span class="hidden sm:inline">{dayNames[cell.date.getDay()]}</span>
						<span class="inline sm:hidden">{dayNames[cell.date.getDay()].slice(0, 3)}</span>
					</div>
					<div
						class="mt-1 text-lg font-semibold md:text-xl {isToday(cell.date)
							? 'mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary md:h-9 md:w-9'
							: ''}"
					>
						{cell.date.getDate()}
					</div>
					{#if isToday(cell.date)}
						<span
							class="rounded bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground uppercase md:text-[9px]"
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
					class="relative min-h-[320px] border-r p-1.5 last:border-r-0 md:min-h-[400px] md:p-2 {!cell.isCurrentMonth
						? 'bg-muted/30'
						: ''} {isToday(cell.date) ? 'bg-primary/10' : ''}"
				>
					<div class="space-y-2">
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
</div>
