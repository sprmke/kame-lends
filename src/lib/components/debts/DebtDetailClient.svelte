<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import DebtForm from '$lib/components/debts/DebtForm.svelte';
	import FormPageSkeleton from '$lib/components/common/FormPageSkeleton.svelte';
	import EditFormSheet from '$lib/components/common/EditFormSheet.svelte';
	import { createIsMobileOverlay } from '$lib/composables/use-media-query.svelte';
	import DebtSummaryPreview from '$lib/components/debts/DebtSummaryPreview.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from '$lib/toast';
	import { formatCurrency, formatDateShort, formatText } from '$lib/format';
	import { normalizeDebtFees } from '$lib/debt-calculations';
	import type { DebtWithInvestorAndPeriods, Investor } from '$lib/types';
	import { ODD_LAST_TWO_COL_GRID } from '$lib/summary-grid';
	import { cn } from '$lib/utils';

	interface Props {
		initialDebt: DebtWithInvestorAndPeriods;
		investors: Investor[];
		canManage?: boolean;
	}

	let { initialDebt, investors, canManage = true }: Props = $props();

	let debt = $state<DebtWithInvestorAndPeriods>(initialDebt);
	let isEditing = $state($page.url.searchParams.get('edit') === '1' && canManage);
	let editSubmitting = $state(false);
	const mobile = createIsMobileOverlay(
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
	);
	const editFormId = $derived(`debt-detail-edit-${debt.id}`);

	$effect(() => mobile.init());

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

{#if isEditing && !mobile.matches}
	<div class="mx-auto max-w-4xl">
		{#if investors.length === 0}
			<FormPageSkeleton />
		{:else}
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
		{/if}
	</div>
{:else}
	<div class="dashboard-form max-w-4xl">
		<DetailHeader
			title={debt.name}
			description={`Investor: ${formatText(debt.investor.name)}`}
			backLabel="Back to Borrowings"
			onBack={() => goto('/debts')}
			onEdit={canManage ? () => (isEditing = true) : undefined}
			onDelete={handleDelete}
			canEdit={canManage}
			canDelete={canManage}
			deleteTitle="Delete borrowing?"
			deleteDescription={`This will permanently delete "${debt.name}".`}
			showPriceToggle={false}
		/>

		<Card.Root>
			<Card.Header>
				<Card.Title>Borrowing Summary</Card.Title>
			</Card.Header>
			<Card.Content>
				<div
					class={cn(ODD_LAST_TWO_COL_GRID, 'grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5')}
				>
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
			onPaymentsChange={canManage ? refreshDebt : undefined}
		/>
	</div>
{/if}

{#if isEditing && mobile.matches}
	<EditFormSheet
		open={true}
		onOpenChange={(open) => {
			if (!open) isEditing = false;
		}}
		title={formatText(debt.name)}
		formId={editFormId}
		isSubmitting={editSubmitting}
		isEditMode={true}
		submitLabel={editSubmitting ? 'Saving...' : 'Save Changes'}
	>
		{#if investors.length === 0}
			<FormPageSkeleton />
		{:else}
			{#key debt.id}
				<DebtForm
					{investors}
					existingDebt={debt}
					initialInterestPeriods={debt.interestPeriods}
					formId={editFormId}
					showFormHeader={false}
					bind:isSubmitting={editSubmitting}
					onSuccess={async () => {
						isEditing = false;
						await refreshDebt();
					}}
					onCancel={() => (isEditing = false)}
					onPaymentsChange={refreshDebt}
				/>
			{/key}
		{/if}
	</EditFormSheet>
{/if}
