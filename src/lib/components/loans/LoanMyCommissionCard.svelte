<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Pencil } from 'lucide-svelte';
	import { calculateInterest, calculateTotalPrincipal } from '$lib/calculations';
	import {
		isCommissionConfigured,
		normalizeCommissionType,
		parseCommissionValue
	} from '$lib/commission';
	import { formatCurrency, formatPercentage } from '$lib/format';
	import LoanCommissionEditor from './LoanCommissionEditor.svelte';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors;
		onRefresh?: () => void | Promise<void>;
	}

	let { loan, onRefresh }: Props = $props();

	let isEditing = $state(false);

	const commission = $derived(loan.myCommission ?? null);
	const totalPrincipal = $derived(calculateTotalPrincipal(loan.loanInvestors));
	const commissionType = $derived(
		normalizeCommissionType(commission?.profitType ?? 'rate')
	);
	const commissionValue = $derived(parseCommissionValue(commission?.profitValue ?? '0'));
	const hasCommission = $derived(
		commission
			? isCommissionConfigured(commission.profitType, commission.profitValue)
			: false
	);
	const currentProfit = $derived(
		commission
			? calculateInterest(totalPrincipal, commission.profitValue, commissionType)
			: 0
	);

	async function handleSaved() {
		isEditing = false;
		await onRefresh?.();
	}
</script>

<Card.Root id="loan-my-commission-section">
	<Card.Header class="flex flex-row items-center justify-between space-y-0">
		<Card.Title class="dashboard-section-title">Your Commission</Card.Title>
		{#if !isEditing}
			<Button variant="outline" size="sm" onclick={() => (isEditing = true)}>
				<Pencil class="mr-1 h-4 w-4" />
				Edit
			</Button>
		{/if}
	</Card.Header>
	<Card.Content>
		{#if isEditing}
			<LoanCommissionEditor
				{loan}
				onCancel={() => (isEditing = false)}
				onSaved={handleSaved}
			/>
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
							{commissionType === 'fixed' ? 'Fixed' : formatPercentage(commissionValue)}
						</p>
					</div>
					<div>
						<p class="text-caption mb-1">Commission</p>
						<p class="text-sm font-semibold tabular-nums">{formatCurrency(currentProfit)}</p>
					</div>
				</div>
				{#if commissionType === 'rate'}
					<div class="rounded-lg border border-border/60 bg-muted/30 p-3">
						<p class="text-caption mb-1">Calculation</p>
						<p class="text-sm tabular-nums">
							{formatPercentage(commissionValue)} of {formatCurrency(totalPrincipal)}
						</p>
						<p class="mt-1 text-sm tabular-nums text-muted-foreground">
							= {formatCurrency(currentProfit)}
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
