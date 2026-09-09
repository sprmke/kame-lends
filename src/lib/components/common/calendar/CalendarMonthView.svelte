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

<div class="overflow-x-auto">
	<div class="min-w-[1200px]">
		<div class="grid grid-cols-7 border-b">
			{#each dayNames as day (day)}
				<div class="border-r p-2 text-center text-sm font-semibold last:border-r-0">
					<span class="hidden sm:inline">{day}</span>
					<span class="inline sm:hidden">{day.slice(0, 3)}</span>
				</div>
			{/each}
		</div>

		<div class="grid grid-cols-7">
			{#each cells as cell, index (index)}
				<div
					class="relative min-h-[120px] border-r border-b p-1.5 last:border-r-0 md:min-h-[140px] md:p-2 {!cell.isCurrentMonth
						? 'bg-muted/30'
						: ''} {isToday(cell.date) ? 'bg-primary/10' : ''}"
				>
					<div class="mb-1 flex items-center justify-between md:mb-2">
						<div
							class="text-xs font-medium md:text-sm {!cell.isCurrentMonth
								? 'text-muted-foreground'
								: ''} {isToday(cell.date) ? 'font-bold text-primary' : ''}"
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

					<div class="space-y-1.5">
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
