<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Sheet from '$lib/components/ui/sheet';
	import { toast } from '$lib/toast';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import { Calendar, Loader2, RefreshCw, Trash2, ChevronDown } from 'lucide-svelte';

	interface Props {
		variant?: 'default' | 'outline' | 'ghost' | 'secondary';
		size?: 'default' | 'sm' | 'lg' | 'icon';
	}

	let { variant = 'outline', size = 'default' }: Props = $props();

	let loading = $state(false);
	let dialogMode = $state<'sync' | 'clear' | null>(null);
	let sheetOpen = $state(false);

	const isMobileShell = createIsMobileShell(false);

	$effect(() => isMobileShell.init());

	function pickAction(mode: 'sync' | 'clear') {
		sheetOpen = false;
		dialogMode = mode;
	}

	async function handleSync() {
		try {
			loading = true;
			const response = await fetch('/api/loans/sync-calendar');
			const data = await response.json();
			if (response.ok) {
				toast.success(`Calendar synced. ${data.successCount ?? 0} loans.`);
			} else {
				toast.error(data.error || 'Failed to sync calendar');
			}
		} catch {
			toast.error('Failed to sync calendar');
		} finally {
			loading = false;
			dialogMode = null;
		}
	}

	async function handleClear() {
		try {
			loading = true;
			const response = await fetch('/api/loans/cleanup-calendar', { method: 'POST' });
			const data = await response.json();
			if (response.ok) {
				toast.success(`Cleared ${data.deletedCount ?? 0} events.`);
			} else {
				toast.error(data.error || 'Failed to clear calendar');
			}
		} catch {
			toast.error('Failed to clear calendar');
		} finally {
			loading = false;
			dialogMode = null;
		}
	}
</script>

{#if isMobileShell.matches}
	<Button
		{variant}
		{size}
		disabled={loading}
		class="touch-target"
		adaptToMobileHero
		aria-label="Calendar"
		onclick={() => (sheetOpen = true)}
	>
		{#if loading}
			<Loader2 class="h-4 w-4 animate-spin" />
		{:else}
			<Calendar class="h-4 w-4" />
		{/if}
	</Button>

	<Sheet.Root open={sheetOpen} onOpenChange={(open) => (sheetOpen = open)}>
		<Sheet.Content side="bottom" class="h-auto gap-0 p-0">
			<Sheet.Header class="border-b border-border/60 px-4 py-3">
				<Sheet.Title class="text-sm font-semibold">Calendar</Sheet.Title>
			</Sheet.Header>

			<div class="flex flex-col gap-0.5 px-2 py-2 pb-[max(0.5rem,var(--safe-area-bottom))]">
				<button
					type="button"
					class="native-press flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
					disabled={loading}
					onclick={() => pickAction('sync')}
				>
					<RefreshCw class="size-4 shrink-0" strokeWidth={1.75} />
					Sync calendar
				</button>
				<button
					type="button"
					class="native-press flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/5"
					disabled={loading}
					onclick={() => pickAction('clear')}
				>
					<Trash2 class="size-4 shrink-0" strokeWidth={1.75} />
					Clear events
				</button>
			</div>
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					{variant}
					{size}
					disabled={loading}
					class="touch-target"
					adaptToMobileHero
					aria-label="Calendar"
				>
					{#if loading}
						<Loader2 class="h-4 w-4 animate-spin" />
					{:else}
						<Calendar class="h-4 w-4" />
					{/if}
					<span class="hidden xl:inline">Calendar</span>
					<ChevronDown class="hidden h-3.5 w-3.5 opacity-60 xl:inline" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => (dialogMode = 'sync')}>
				<RefreshCw class="h-4 w-4" />
				Sync calendar
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={() => (dialogMode = 'clear')} class="text-destructive">
				<Trash2 class="h-4 w-4" />
				Clear events
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}

<AlertDialog.Root
	open={dialogMode !== null}
	onOpenChange={(open) => {
		if (!open) dialogMode = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				{dialogMode === 'clear' ? 'Clear calendar events?' : 'Sync calendar?'}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{dialogMode === 'clear'
					? 'This removes loan events from Google Calendar.'
					: 'This pushes loan due dates to Google Calendar.'}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={loading}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				disabled={loading}
				onclick={() => (dialogMode === 'clear' ? handleClear() : handleSync())}
			>
				{dialogMode === 'clear' ? 'Clear' : 'Sync'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
