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

<div class="min-w-0 space-y-3">
	<CalendarHeader
		title={calendar.getViewTitle()}
		compactTitle={calendar.getViewTitle(true)}
		viewMode={calendar.viewMode}
		onViewModeChange={calendar.setViewMode}
		onToday={calendar.goToToday}
		onPrevious={calendar.goToPreviousPeriod}
		onNext={calendar.goToNextPeriod}
		{showLegend}
		legendGroups={config.legendGroups}
	/>

	<Card.Root class="min-w-0">
		<Card.Content class="min-w-0 overflow-hidden p-0">
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
