<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { CalendarDays, GanttChart, LayoutGrid, Table as TableIcon } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { ViewMode } from '$lib/composables/use-responsive-view-mode.svelte';

	interface Props {
		viewMode: ViewMode;
		onViewModeChange: (mode: ViewMode) => void;
		showCalendar?: boolean;
		showTimeline?: boolean;
		hasData?: boolean;
		class?: string;
	}

	let {
		viewMode,
		onViewModeChange,
		showCalendar = false,
		showTimeline = false,
		hasData = true,
		class: className = ''
	}: Props = $props();

	const modes = $derived<
		Array<{ id: ViewMode; icon: typeof TableIcon; label: string; lgOnly?: boolean }>
	>([
		{ id: 'table', icon: TableIcon, label: 'Table', lgOnly: true },
		{ id: 'cards', icon: LayoutGrid, label: 'Cards' },
		...(showCalendar
			? [{ id: 'calendar' as ViewMode, icon: CalendarDays, label: 'Calendar', lgOnly: true }]
			: []),
		...(showTimeline ? [{ id: 'timeline' as ViewMode, icon: GanttChart, label: 'Timeline' }] : [])
	]);
</script>

<div class={cn('pill-segment inline-flex h-11 shrink-0 gap-0.5 p-0.5', className)}>
	{#each modes as { id, icon: Icon, label, lgOnly }}
		<Button
			type="button"
			variant={viewMode === id ? 'secondary' : 'ghost'}
			onclick={() => onViewModeChange(id)}
			class={cn(
				'touch-hit h-10 min-h-0 w-10 shrink-0 rounded-lg p-0 shadow-none',
				lgOnly && 'hidden lg:inline-flex',
				viewMode === id && 'bg-muted text-foreground'
			)}
			title="{label} view"
			disabled={!hasData}
			aria-label="{label} view"
			aria-pressed={viewMode === id}
		>
			<Icon class="h-3.5 w-3.5" />
		</Button>
	{/each}
</div>
