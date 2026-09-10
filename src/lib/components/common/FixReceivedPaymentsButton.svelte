<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { toast } from '$lib/toast';
	import { CheckCircle2, Loader2, Wrench } from 'lucide-svelte';

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

	async function handleFix() {
		isRunning = true;
		justDone = false;

		try {
			const response = await fetch('/api/loans/fix-received-payments', { method: 'POST' });
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'Fix failed');

			justDone = true;

			if (data.createdPayments === 0 && data.orphanedPaymentsRemoved === 0) {
				toast.success('All payments are consistent', {
					description: 'No missing or orphaned received payments found.'
				});
			} else {
				const parts: string[] = [];
				if (data.createdPayments > 0) {
					parts.push(`Restored ${data.createdPayments} missing payment(s)`);
				}
				if (data.orphanedPaymentsRemoved > 0) {
					parts.push(`Removed ${data.orphanedPaymentsRemoved} orphaned payment(s)`);
				}
				toast.success('Payments repaired', {
					description: data.fixedLoans?.length
						? `${parts.join(', ')} across: ${data.fixedLoans.join(', ')}`
						: parts.join(', ')
				});
			}

			setTimeout(() => {
				justDone = false;
			}, 4000);
		} catch (error) {
			console.error('Error fixing received payments:', error);
			toast.error('Repair failed', { description: error instanceof Error ? error.message : 'Unknown error' });
		} finally {
			isRunning = false;
		}
	}
</script>

<Button {variant} {size} class={className} disabled={isRunning} onclick={handleFix}>
	{#if isRunning}
		<Loader2 class="h-4 w-4 animate-spin" />
	{:else if justDone}
		<CheckCircle2 class="h-4 w-4 text-chart-2" />
	{:else}
		<Wrench class="h-4 w-4" />
	{/if}
	{#if showLabel}
		<span class="ml-2">{isRunning ? 'Repairing…' : justDone ? 'Done!' : 'Fix Payments'}</span>
	{/if}
</Button>
