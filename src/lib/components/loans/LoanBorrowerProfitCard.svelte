<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Pencil, X } from 'lucide-svelte';
	import { calculateInterest, calculateTotalPrincipal } from '$lib/calculations';
	import { formatCurrency, formatPercentage, formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		onRefresh?: () => void | Promise<void>;
	}

	let { loan, onRefresh }: Props = $props();

	let isEditing = $state(false);
	let profitType = $state<'rate' | 'fixed'>('rate');
	let profitValue = $state('0');
	let isSaving = $state(false);

	const totalPrincipal = $derived(calculateTotalPrincipal(loan.loanInvestors));
	const currentProfit = $derived(
		calculateInterest(totalPrincipal, loan.profitValue, loan.profitType)
	);

	function startEdit() {
		profitType = loan.profitType;
		profitValue = loan.profitValue;
		isEditing = true;
	}

	async function save() {
		isSaving = true;
		try {
			const response = await fetch(`/api/loans/${loan.id}/profit`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ profitType, profitValue })
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.error ?? 'Failed to update profit');
			}
			toast.success('Profit updated');
			isEditing = false;
			await onRefresh?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update profit');
		} finally {
			isSaving = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="flex flex-row items-center justify-between space-y-0">
		<Card.Title class="dashboard-section-title">Your Profit</Card.Title>
		{#if !isEditing}
			<Button variant="outline" size="sm" onclick={startEdit}>
				<Pencil class="mr-1 h-4 w-4" />
				Edit
			</Button>
		{/if}
	</Card.Header>
	<Card.Content>
		{#if isEditing}
			<div class="space-y-3">
				<Tabs.Root value={profitType} onValueChange={(v) => v && (profitType = v as 'rate' | 'fixed')}>
					<Tabs.List class="grid w-full grid-cols-2">
						<Tabs.Trigger value="rate">Rate (%)</Tabs.Trigger>
						<Tabs.Trigger value="fixed">Fixed (₱)</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>
				<Input
					type="number"
					min="0"
					step="0.01"
					bind:value={profitValue}
					placeholder={profitType === 'rate' ? '10' : '0.00'}
					disabled={isSaving}
				/>
				<div class="flex justify-end gap-2">
					<Button variant="outline" size="sm" onclick={() => (isEditing = false)} disabled={isSaving}>
						<X class="mr-1 h-4 w-4" />
						Cancel
					</Button>
					<Button size="sm" onclick={save} disabled={isSaving}>
						{isSaving ? 'Saving...' : 'Save'}
					</Button>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-3">
				<div>
					<p class="text-caption mb-1">Profit Rate</p>
					<p class="text-sm font-semibold">
						{loan.profitType === 'fixed'
							? formatText('Fixed')
							: formatPercentage(Number(loan.profitValue))}
					</p>
				</div>
				<div>
					<p class="text-caption mb-1">Profit</p>
					<p class="text-sm font-semibold tabular-nums">{formatCurrency(currentProfit)}</p>
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
