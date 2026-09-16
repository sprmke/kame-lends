<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Pencil, X } from 'lucide-svelte';
	import { calculateInterest, calculateTotalPrincipal } from '$lib/calculations';
	import {
		isCommissionConfigured,
		normalizeCommissionType,
		parseCommissionValue
	} from '$lib/commission';
	import { scrollCommissionSectionIntoView } from '$lib/commission-edit-slot';
	import { formatCurrency, formatPercentage } from '$lib/format';
	import { toast } from '$lib/toast';
	import type { LoanInvestor, LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		allocation: LoanInvestor;
		title?: string;
		sectionId?: string;
		onRefresh?: () => void | Promise<void>;
		autoStartEdit?: boolean;
	}

	let {
		loan,
		allocation,
		title = 'Your Commission',
		sectionId = 'loan-investor-commission-section',
		onRefresh,
		autoStartEdit = false
	}: Props = $props();

	let isEditing = $state(false);
	let profitType = $state<'rate' | 'fixed'>('rate');
	let profitValue = $state('0');
	let isSaving = $state(false);

	const totalPrincipal = $derived(calculateTotalPrincipal(loan.loanInvestors));
	const commissionType = $derived(normalizeCommissionType(allocation.profitType));
	const commissionValue = $derived(parseCommissionValue(allocation.profitValue));
	const hasCommission = $derived(
		isCommissionConfigured(allocation.profitType, allocation.profitValue)
	);
	const currentCommission = $derived(
		calculateInterest(totalPrincipal, allocation.profitValue, commissionType)
	);
	const draftValue = $derived(Number.parseFloat(profitValue));
	const draftValueValid = $derived(Number.isFinite(draftValue) && draftValue >= 0);
	const draftCommission = $derived(
		draftValueValid ? calculateInterest(totalPrincipal, profitValue, profitType) : 0
	);

	function startEdit() {
		profitType = allocation.profitType;
		profitValue = allocation.profitValue;
		isEditing = true;
	}

	$effect(() => {
		if (!autoStartEdit || isEditing) return;
		startEdit();
		scrollCommissionSectionIntoView();
	});

	async function save() {
		isSaving = true;
		try {
			const response = await fetch(
				`/api/loans/${loan.id}/investors/${allocation.id}/commission`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ profitType, profitValue })
				}
			);
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.error ?? 'Failed to update commission');
			}
			toast.success('Commission updated');
			isEditing = false;
			await onRefresh?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update commission');
		} finally {
			isSaving = false;
		}
	}
</script>

<Card.Root id={sectionId}>
	<Card.Header class="flex flex-row items-center justify-between space-y-0">
		<Card.Title class="dashboard-section-title">{title}</Card.Title>
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
				<div class="space-y-1.5">
					<Label for="investor-commission-value">
						{profitType === 'rate' ? 'Rate (% of principal)' : 'Fixed amount'}
					</Label>
					<Input
						id="investor-commission-value"
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
					<Button variant="outline" size="sm" onclick={() => (isEditing = false)} disabled={isSaving}>
						<X class="mr-1 h-4 w-4" />
						Cancel
					</Button>
					<Button size="sm" onclick={save} disabled={isSaving}>
						{isSaving ? 'Saving...' : 'Save'}
					</Button>
				</div>
			</div>
		{:else if !hasCommission}
			<p class="text-sm text-muted-foreground">Not set</p>
		{:else}
			<div class="space-y-3">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<p class="text-caption mb-1">
							{commissionType === 'rate' ? 'Rate' : 'Type'}
						</p>
						<p class="text-sm font-semibold">
							{commissionType === 'fixed'
								? 'Fixed'
								: formatPercentage(commissionValue)}
						</p>
					</div>
					<div>
						<p class="text-caption mb-1">Commission</p>
						<p class="text-sm font-semibold tabular-nums">{formatCurrency(currentCommission)}</p>
					</div>
				</div>
				{#if commissionType === 'rate'}
					<div class="rounded-lg border border-border/60 bg-muted/30 p-3">
						<p class="text-caption mb-1">Calculation</p>
						<p class="text-sm tabular-nums">
							{formatPercentage(commissionValue)} of {formatCurrency(totalPrincipal)}
						</p>
						<p class="mt-1 text-sm tabular-nums text-muted-foreground">
							= {formatCurrency(currentCommission)}
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
