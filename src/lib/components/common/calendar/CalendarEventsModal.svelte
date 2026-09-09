<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { formatDate } from '$lib/format';
	import { priceVisibility } from '$lib/stores/price-visibility.svelte';
	import DailySummary from './DailySummary.svelte';
	import type { CalendarConfig, CalendarEvent } from './types';

	interface Props {
		date: Date;
		events: CalendarEvent[];
		config: CalendarConfig;
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}

	let { date, events, config, open, onOpenChange }: Props = $props();

	// Re-render when price visibility toggles.
	$effect(() => {
		void priceVisibility.pricesHidden;
	});
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	title="Events for {formatDate(date)}"
	contentClass="dashboard-dialog-calendar flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg"
>
	<div class="flex min-h-0 flex-1 flex-col gap-3">
		<div class="shrink-0">
			<DailySummary
				{events}
				formatCurrency={config.formatCurrency}
				alwaysShow={config.alwaysShowSummary}
			/>
		</div>

		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<h3 class="mb-2 shrink-0 text-xs font-semibold text-muted-foreground">
				All Events ({events.length})
			</h3>
			{#if events.length > 0}
				<div class="flex-1 overflow-y-auto pr-1">
					<div class="space-y-2">
						{#if config.eventCard}
							{#each events as event, eventIndex (eventIndex)}
								{@render config.eventCard(event, eventIndex)}
							{/each}
						{/if}
					</div>
				</div>
			{:else}
				<div class="dashboard-empty text-sm text-muted-foreground">No events for this day</div>
			{/if}
		</div>
	</div>
</ResponsiveModal>
