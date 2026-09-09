<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { createCalendarState } from './use-calendar.svelte';
	import CalendarHeader from './CalendarHeader.svelte';
	import CalendarDayView from './CalendarDayView.svelte';
	import CalendarWeekView from './CalendarWeekView.svelte';
	import CalendarMonthView from './CalendarMonthView.svelte';
	import type { CalendarConfig, CalendarEvent } from './types';

	interface Props {
		events: CalendarEvent[];
		config: CalendarConfig;
		showLegend?: boolean;
	}

	let { events, config, showLegend = true }: Props = $props();

	const calendar = createCalendarState(() => events);
</script>

<div class="space-y-4">
	<CalendarHeader
		title={calendar.getViewTitle()}
		viewMode={calendar.viewMode}
		onViewModeChange={calendar.setViewMode}
		onToday={calendar.goToToday}
		onPrevious={calendar.goToPreviousPeriod}
		onNext={calendar.goToNextPeriod}
		{showLegend}
		legendGroups={config.legendGroups}
	/>

	{#if calendar.viewMode === 'week' || calendar.viewMode === 'month'}
		<div class="rounded-lg bg-muted/30 py-1 text-center text-xs text-muted-foreground md:hidden">
			← Swipe to scroll horizontally →
		</div>
	{/if}

	<Card.Root>
		<Card.Content class="p-0">
			{#if calendar.viewMode === 'day'}
				<CalendarDayView cells={calendar.calendarData} {config} />
			{:else if calendar.viewMode === 'week'}
				<CalendarWeekView
					cells={calendar.calendarData}
					{config}
					dayNames={calendar.dayNames}
					isToday={calendar.isToday}
				/>
			{:else}
				<CalendarMonthView
					cells={calendar.calendarData}
					{config}
					dayNames={calendar.dayNames}
					isToday={calendar.isToday}
				/>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
