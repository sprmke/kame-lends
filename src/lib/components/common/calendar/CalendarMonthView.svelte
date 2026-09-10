<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import DailySummary from './DailySummary.svelte';
	import CalendarEventsModal from './CalendarEventsModal.svelte';
	import type { CalendarCell, CalendarConfig } from './types';

	interface Props {
		cells: CalendarCell[];
		config: CalendarConfig;
		dayNames: string[];
		isToday: (date: Date) => boolean;
	}

	let { cells, config, dayNames, isToday }: Props = $props();

	const MAX_VISIBLE_EVENTS = 1;

	let modalOpen = $state(false);
	let modalDate = $state<Date | null>(null);
	let modalEvents = $state<CalendarCell['events']>([]);

	function handleViewMore(cell: CalendarCell) {
		modalDate = cell.date;
		modalEvents = cell.events;
		modalOpen = true;
	}

	function closeModal() {
		modalOpen = false;
		modalDate = null;
		modalEvents = [];
	}
</script>

<div class="w-full min-w-0">
	<div class="grid grid-cols-7 border-b">
		{#each dayNames as day (day)}
			<div
				class="min-w-0 border-r p-1 text-center text-[11px] font-semibold last:border-r-0 lg:p-2 lg:text-sm"
			>
				<span class="hidden xl:inline">{day}</span>
				<span class="inline xl:hidden">{day.slice(0, 3)}</span>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-7">
		{#each cells as cell, index (index)}
			<div
				class="relative min-h-[5.5rem] min-w-0 border-r border-b p-1 last:border-r-0 sm:min-h-[6.5rem] sm:p-1.5 lg:min-h-[7.5rem] lg:p-2 xl:min-h-[8.75rem] {!cell.isCurrentMonth
					? 'bg-muted/30'
					: ''} {isToday(cell.date) ? 'bg-primary/5' : ''}"
			>
					<div class="mb-1 flex items-center justify-between md:mb-2">
						<div
							class="text-xs font-medium md:text-sm {!cell.isCurrentMonth
								? 'text-muted-foreground'
								: ''} {isToday(cell.date) ? 'font-semibold text-primary/80' : ''}"
						>
							{cell.date.getDate()}
						</div>
						{#if isToday(cell.date)}
							<span
								class="hidden rounded bg-primary/15 px-1.5 py-0.5 text-[8px] font-semibold text-primary/80 uppercase sm:inline md:text-[9px]"
							>
								Today
							</span>
						{/if}
					</div>

					<div class="min-w-0 space-y-1.5">
						<DailySummary
							events={cell.events}
							formatCurrency={config.formatCurrency}
							size="sm"
							alwaysShow={config.alwaysShowSummary}
						/>

						{#if config.eventCard}
							{#each cell.events.slice(0, MAX_VISIBLE_EVENTS) as event, eventIndex (eventIndex)}
								{@render config.eventCard(event, eventIndex)}
							{/each}
						{/if}

						{#if cell.events.length > MAX_VISIBLE_EVENTS}
							<Button
								variant="outline"
								size="sm"
								onclick={() => handleViewMore(cell)}
								class="h-6 w-full py-1 text-xs hover:bg-primary/10"
							>
								+{cell.events.length - MAX_VISIBLE_EVENTS} more
							</Button>
						{/if}
					</div>
				</div>
		{/each}
	</div>
</div>

{#if modalDate}
	<CalendarEventsModal
		date={modalDate}
		events={modalEvents}
		{config}
		open={modalOpen}
		onOpenChange={(open) => {
			if (!open) closeModal();
		}}
	/>
{/if}
