<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs';
	import { X } from 'lucide-svelte';
	import { calculateInterest, calculateTotalPrincipal } from '$lib/calculations';
	import { formatCurrency, formatPercentage } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		onSaved?: () => void | Promise<void>;
		onCancel?: () => void;
	}

	let { loan, onSaved, onCancel }: Props = $props();

	let profitType = $state<'rate' | 'fixed'>('rate');
	let profitValue = $state('0');
	let isSaving = $state(false);

	const commission = $derived(loan.myCommission ?? null);
	const totalPrincipal = $derived(calculateTotalPrincipal(loan.loanInvestors));
	const draftValue = $derived(Number.parseFloat(profitValue));
	const draftValueValid = $derived(Number.isFinite(draftValue) && draftValue >= 0);
	const draftCommission = $derived(
		draftValueValid ? calculateInterest(totalPrincipal, profitValue, profitType) : 0
	);

	$effect(() => {
		profitType = commission?.profitType ?? 'rate';
		profitValue = commission?.profitValue ?? '0';
	});

	async function save() {
		isSaving = true;
		try {
			const response = await fetch(`/api/loans/${loan.id}/my-commission`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ profitType, profitValue })
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.error ?? 'Failed to update commission');
			}
			toast.success('Commission updated');
			await onSaved?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update commission');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-3">
	<Tabs.Root value={profitType} onValueChange={(v) => v && (profitType = v as 'rate' | 'fixed')}>
		<Tabs.List class="grid w-full grid-cols-2">
			<Tabs.Trigger value="rate">Rate (%)</Tabs.Trigger>
			<Tabs.Trigger value="fixed">Fixed (₱)</Tabs.Trigger>
		</Tabs.List>
	</Tabs.Root>
	<div class="space-y-1.5">
		<Label for="commission-value">
			{profitType === 'rate' ? 'Rate (% of principal)' : 'Fixed amount'}
		</Label>
		<Input
			id="commission-value"
			type="number"
			min="0"
			step="0.01"
			bind:value={profitValue}
			placeholder={profitType === 'rate' ? '10' : '0.00'}
			disabled={isSaving}
		/>
	</div>
	<div class="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
		{#if profitType === 'rate'}
			<p class="text-caption">Principal</p>
			<p class="text-sm font-semibold tabular-nums">{formatCurrency(totalPrincipal)}</p>
			{#if draftValueValid}
				<p class="text-sm tabular-nums text-muted-foreground">
					{formatPercentage(draftValue)} of {formatCurrency(totalPrincipal)}
				</p>
				<div class="flex items-baseline justify-between gap-3 border-t border-border/50 pt-2">
					<p class="text-caption">Commission preview</p>
					<p class="text-sm font-semibold tabular-nums">{formatCurrency(draftCommission)}</p>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">Enter a valid rate to preview commission.</p>
			{/if}
		{:else if draftValueValid}
			<div class="flex items-baseline justify-between gap-3">
				<p class="text-caption">Commission preview</p>
				<p class="text-sm font-semibold tabular-nums">{formatCurrency(draftCommission)}</p>
			</div>
			<p class="text-sm text-muted-foreground">Flat amount, not based on principal.</p>
		{:else}
			<p class="text-sm text-muted-foreground">Enter a valid amount to preview commission.</p>
		{/if}
	</div>
	<div class="flex justify-end gap-2">
		<Button variant="outline" size="sm" onclick={() => onCancel?.()} disabled={isSaving}>
			<X class="mr-1 h-4 w-4" />
			Cancel
		</Button>
		<Button size="sm" onclick={save} disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save'}
		</Button>
	</div>
</div>
