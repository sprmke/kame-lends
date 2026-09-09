<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { LayoutGrid, Table as TableIcon, CalendarDays } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { ViewMode } from '$lib/composables/use-responsive-view-mode.svelte';

	interface Props {
		viewMode: ViewMode;
		onViewModeChange: (mode: ViewMode) => void;
		showCalendar?: boolean;
		hasData?: boolean;
	}

	let { viewMode, onViewModeChange, showCalendar = false, hasData = true }: Props = $props();

	const modes: Array<{ id: ViewMode; icon: typeof TableIcon; label: string; hidden?: boolean }> = [
		{ id: 'table', icon: TableIcon, label: 'Table', hidden: true },
		{ id: 'cards', icon: LayoutGrid, label: 'Cards' },
		...(showCalendar ? [{ id: 'calendar' as ViewMode, icon: CalendarDays, label: 'Calendar' }] : [])
	];
</script>

<div class="pill-segment">
	{#each modes as { id, icon: Icon, label, hidden }}
		<Button
			variant={viewMode === id ? 'secondary' : 'ghost'}
			size="sm"
			onclick={() => hasData && onViewModeChange(id)}
			class={cn(
				'h-7 rounded-md px-2.5',
				hidden && 'hidden md:flex',
				viewMode === id && 'shadow-none'
			)}
			title="{label} view"
			disabled={!hasData}
		>
			<Icon class="h-4 w-4" />
		</Button>
	{/each}
</div>
