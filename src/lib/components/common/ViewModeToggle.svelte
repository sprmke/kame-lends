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
		class?: string;
	}

	let {
		viewMode,
		onViewModeChange,
		showCalendar = false,
		hasData = true,
		class: className = ''
	}: Props = $props();

	const modes: Array<{ id: ViewMode; icon: typeof TableIcon; label: string; hidden?: boolean }> = [
		{ id: 'table', icon: TableIcon, label: 'Table', hidden: true },
		{ id: 'cards', icon: LayoutGrid, label: 'Cards' },
		...(showCalendar ? [{ id: 'calendar' as ViewMode, icon: CalendarDays, label: 'Calendar' }] : [])
	];
</script>

<div class={cn('pill-segment h-11 shrink-0 gap-0.5 p-0.5', className)}>
	{#each modes as { id, icon: Icon, label, hidden }}
		<Button
			variant={viewMode === id ? 'secondary' : 'ghost'}
			onclick={() => hasData && onViewModeChange(id)}
			class={cn(
				'touch-hit h-10 min-h-0 w-10 shrink-0 rounded-lg p-0 shadow-none',
				hidden && 'hidden lg:inline-flex',
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
