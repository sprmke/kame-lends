<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/toast';
	import { CalendarSync, CheckCircle2, Loader2 } from 'lucide-svelte';

	interface Props {
		variant?: 'default' | 'outline' | 'ghost';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		class?: string;
		showLabel?: boolean;
	}

	let {
		variant = 'outline',
		size = 'default',
		class: className,
		showLabel = true
	}: Props = $props();

	let isRunning = $state(false);
	let justDone = $state(false);

	async function handleSync() {
		isRunning = true;
		justDone = false;

		try {
			const response = await fetch('/api/loans/sync-due-dates', { method: 'POST' });
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'Sync failed');

			justDone = true;

			if (data.updatedCount === 0) {
				toast.success(
					'Due dates already up to date',
					'All loan due dates match their last interest period.'
				);
			} else {
				toast.success(
					`Updated ${data.updatedCount} loan due date(s)`,
					data.updatedLoans?.length ? `Updated: ${data.updatedLoans.join(', ')}` : data.message
				);
			}

			setTimeout(() => {
				justDone = false;
			}, 4000);
		} catch (error) {
			console.error('Error syncing loan due dates:', error);
			toast.error('Sync failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			isRunning = false;
		}
	}
</script>

<Button {variant} {size} class={className} disabled={isRunning} onclick={handleSync}>
	{#if isRunning}
		<Loader2 class="h-4 w-4 animate-spin" />
	{:else if justDone}
		<CheckCircle2 class="h-4 w-4 text-green-500" />
	{:else}
		<CalendarSync class="h-4 w-4" />
	{/if}
	{#if showLabel}
		<span class="ml-2">{isRunning ? 'Syncing…' : justDone ? 'Done!' : 'Sync Due Dates'}</span>
	{/if}
</Button>
