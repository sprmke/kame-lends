<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
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

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content
		class="dashboard-dialog-calendar flex h-[85vh] flex-col overflow-hidden"
		showCloseButton
	>
		<Dialog.Header class="flex-shrink-0 border-b px-3 pt-3 pb-2">
			<Dialog.Title class="text-sm font-semibold">Events for {formatDate(date)}</Dialog.Title>
		</Dialog.Header>

		<div class="flex-shrink-0 px-3 pt-2">
			<DailySummary
				{events}
				formatCurrency={config.formatCurrency}
				alwaysShow={config.alwaysShowSummary}
			/>
		</div>

		<div class="flex flex-1 flex-col overflow-hidden px-3 pb-3">
			<h3 class="mb-2 flex-shrink-0 text-xs font-semibold text-muted-foreground">
				All Events ({events.length})
			</h3>
			{#if events.length > 0}
				<div class="flex-1 overflow-y-auto pr-2">
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
	</Dialog.Content>
</Dialog.Root>
