<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { toast } from '$lib/toast';
	import { Calendar, Loader2, RefreshCw, Trash2, ChevronDown } from 'lucide-svelte';

	interface Props {
		variant?: 'default' | 'outline' | 'ghost' | 'secondary';
		size?: 'default' | 'sm' | 'lg' | 'icon';
	}

	let { variant = 'outline', size = 'default' }: Props = $props();

	let loading = $state(false);
	let dialogMode = $state<'sync' | 'clear' | null>(null);

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

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} {variant} {size} disabled={loading} class="touch-target">
				{#if loading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<Calendar class="h-4 w-4" />
				{/if}
				<span class="hidden xl:inline">Calendar</span>
				<ChevronDown class="h-3.5 w-3.5 opacity-60" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.Item onclick={() => (dialogMode = 'sync')}>
			<RefreshCw class="mr-2 h-4 w-4" />
			Sync calendar
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={() => (dialogMode = 'clear')} class="text-destructive">
			<Trash2 class="mr-2 h-4 w-4" />
			Clear events
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

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
