<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import DebtForm from '$lib/components/debts/DebtForm.svelte';
	import DebtSummaryPreview from '$lib/components/debts/DebtSummaryPreview.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from '$lib/toast';
	import { formatCurrency, formatDateShort, formatText } from '$lib/format';
	import { normalizeDebtFees } from '$lib/debt-calculations';
	import type { DebtWithInvestorAndPeriods, Investor } from '$lib/types';

	interface Props {
		initialDebt: DebtWithInvestorAndPeriods;
		investors: Investor[];
	}

	let { initialDebt, investors }: Props = $props();

	let debt = $state<DebtWithInvestorAndPeriods>(initialDebt);
	let isEditing = $state($page.url.searchParams.get('edit') === '1');

	const fees = $derived(debt.additionalFees ?? []);
	const debtDate = $derived(
		debt.date instanceof Date
			? debt.date.toISOString().split('T')[0]
			: String(debt.date).split('T')[0]
	);

	async function refreshDebt() {
		try {
			const response = await fetch(`/api/debts/${debt.id}`);
			if (!response.ok) throw new Error('Failed to fetch borrowing');
			debt = (await response.json()) as DebtWithInvestorAndPeriods;
		} catch (error) {
			console.error('Error refreshing debt:', error);
		}
	}

	async function handleDelete() {
		const response = await fetch(`/api/debts/${debt.id}`, { method: 'DELETE' });
		if (!response.ok) throw new Error('Failed to delete');
		toast.success('Borrowing deleted');
		await goto('/debts');
	}
</script>

{#if isEditing}
	<div class="mx-auto max-w-4xl">
		{#key debt.id}
			<DebtForm
				{investors}
				existingDebt={debt}
				initialInterestPeriods={debt.interestPeriods}
				onSuccess={async () => {
					isEditing = false;
					await refreshDebt();
				}}
				onCancel={() => (isEditing = false)}
				onPaymentsChange={refreshDebt}
			/>
		{/key}
	</div>
{:else}
	<div class="dashboard-form max-w-4xl">
		<DetailHeader
			title={debt.name}
			description={`Investor: ${formatText(debt.investor.name)}`}
			backLabel="Back to Borrowings"
			onBack={() => goto('/debts')}
			onEdit={() => (isEditing = true)}
			onDelete={handleDelete}
			deleteTitle="Delete borrowing?"
			deleteDescription={`This will permanently delete "${debt.name}".`}
			showPriceToggle={false}
		/>

		<Card.Root>
			<Card.Header>
				<Card.Title>Borrowing Summary</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
					<div class="rounded-lg bg-muted/50 p-3">
						<p class="mb-1 text-xs text-muted-foreground">Principal</p>
						<p class="text-sm font-semibold">{formatCurrency(debt.amount)}</p>
					</div>
					<div class="rounded-lg bg-muted/50 p-3">
						<p class="mb-1 text-xs text-muted-foreground">Start Date</p>
						<p class="text-sm font-semibold">{formatDateShort(debt.date)}</p>
					</div>
					<div class="rounded-lg bg-muted/50 p-3">
						<p class="mb-1 text-xs text-muted-foreground">Interest Rate</p>
						<p class="text-sm font-semibold">{debt.interestRate}%</p>
					</div>
					<div class="rounded-lg bg-muted/50 p-3">
						<p class="mb-1 text-xs text-muted-foreground">Accrual Period</p>
						<Badge variant="secondary">{debt.interestInterval}</Badge>
					</div>
					<div class="rounded-lg bg-muted/50 p-3">
						<p class="mb-1 text-xs text-muted-foreground">Duration</p>
						<p class="text-sm font-semibold">{debt.durationMonths} months</p>
					</div>
				</div>

				{#if fees.length > 0}
					<div class="mt-4 space-y-2">
						<p class="text-xs font-semibold text-muted-foreground">Additional Fees</p>
						{#each fees as fee, index (index)}
							<div class="flex justify-between rounded border p-2 text-sm">
								<span>{fee.label}</span>
								<span class="font-medium">{formatCurrency(fee.amount)}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if debt.notes}
					<div class="mt-4 space-y-1">
						<p class="text-xs font-semibold text-muted-foreground">Notes</p>
						<p class="text-sm text-muted-foreground">{debt.notes}</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<DebtSummaryPreview
			principal={String(debt.amount)}
			interestRate={String(debt.interestRate)}
			interestInterval={debt.interestInterval}
			{debtDate}
			durationMonths={debt.durationMonths}
			additionalFees={normalizeDebtFees(fees)}
			interestPeriods={debt.interestPeriods}
			onPaymentsChange={refreshDebt}
		/>
	</div>
{/if}
