<script lang="ts">
	import { goto } from '$app/navigation';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from '$lib/toast';
	import { formatCurrency, formatDateShort, formatText } from '$lib/format';
	import DebtSummaryPreview from '$lib/components/debts/DebtSummaryPreview.svelte';
	import DetailModalHeader from '$lib/components/common/DetailModalHeader.svelte';
	import type { DebtWithInvestorAndPeriods } from '$lib/types';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		debt: DebtWithInvestorAndPeriods | null;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onUpdate?: () => void | Promise<void>;
	}

	let { debt: initialDebt, open, onOpenChange, onUpdate }: Props = $props();

	let debt = $state<DebtWithInvestorAndPeriods | null>(initialDebt);
	let isLoading = $state(false);
	let showDeleteDialog = $state(false);
	let isDeleting = $state(false);

	$effect(() => {
		if (!open || !initialDebt?.id) {
			if (!open) debt = initialDebt;
			return;
		}

		let active = true;
		isLoading = true;
		fetch(`/api/debts/${initialDebt.id}`)
			.then((response) => {
				if (!response.ok) throw new Error('Failed to fetch borrowing');
				return response.json();
			})
			.then((data) => {
				if (active) debt = data as DebtWithInvestorAndPeriods;
			})
			.catch((error) => {
				console.error(error);
				toast.error('Failed to load borrowing details');
			})
			.finally(() => {
				if (active) isLoading = false;
			});

		return () => {
			active = false;
		};
	});

	const debtDate = $derived(
		debt?.date instanceof Date
			? debt.date.toISOString().split('T')[0]
			: String(debt?.date ?? '').split('T')[0]
	);

	async function handleDelete() {
		if (!debt?.id) return;
		isDeleting = true;
		try {
			const response = await fetch(`/api/debts/${debt.id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error('Failed to delete');
			toast.success('Borrowing deleted');
			showDeleteDialog = false;
			onOpenChange(false);
			await onUpdate?.();
		} catch (error) {
			console.error(error);
			toast.error('Failed to delete borrowing');
		} finally {
			isDeleting = false;
		}
	}
</script>

{#if debt}
	<ResponsiveModal
		{open}
		{onOpenChange}
		title={formatText(debt.name)}
		description={formatText(debt.investor.name)}
		showCloseButton={false}
		contentClass="dashboard-dialog-wide sm:max-w-4xl"
	>
		<div class="mb-3 flex flex-col items-start justify-between gap-3 md:flex-row md:gap-4">
			<DetailModalHeader
				onEdit={() => {
					if (!debt) return;
					onOpenChange(false);
					goto(`/debts/${debt.id}?edit=1`);
				}}
				onDelete={() => (showDeleteDialog = true)}
				onClose={() => onOpenChange(false)}
			/>
		</div>

		{#if isLoading}
			<div class="flex items-center justify-center py-16">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		{:else}
			<div class="space-y-4">
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
						<p class="mb-1 text-xs text-muted-foreground">Period</p>
						<Badge variant="secondary">{debt.interestInterval}</Badge>
					</div>
					<div class="rounded-lg bg-muted/50 p-3">
						<p class="mb-1 text-xs text-muted-foreground">Duration</p>
						<p class="text-sm font-semibold">{debt.durationMonths} months</p>
					</div>
				</div>

				{#if (debt.additionalFees ?? []).length > 0}
					<div class="space-y-2">
						<p class="text-xs font-semibold text-muted-foreground">Additional Fees</p>
						{#each debt.additionalFees ?? [] as fee, index (index)}
							<div class="flex justify-between rounded border p-2 text-sm">
								<span>{fee.label}</span>
								<span class="font-medium">{formatCurrency(fee.amount)}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if debt.notes}
					<div class="space-y-1">
						<p class="text-xs font-semibold text-muted-foreground">Notes</p>
						<p class="text-sm text-muted-foreground">{debt.notes}</p>
					</div>
				{/if}

				<DebtSummaryPreview
					principal={String(debt.amount)}
					interestRate={String(debt.interestRate)}
					interestInterval={debt.interestInterval}
					{debtDate}
					durationMonths={debt.durationMonths}
					additionalFees={debt.additionalFees ?? []}
					interestPeriods={debt.interestPeriods}
					onPaymentsChange={async () => {
						if (!initialDebt?.id) return;
						const response = await fetch(`/api/debts/${initialDebt.id}`);
						if (response.ok) debt = (await response.json()) as DebtWithInvestorAndPeriods;
						await onUpdate?.();
					}}
				/>
			</div>
		{/if}
	</ResponsiveModal>

	<AlertDialog.Root open={showDeleteDialog} onOpenChange={(v) => (showDeleteDialog = v)}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Delete borrowing?</AlertDialog.Title>
				<AlertDialog.Description>
					This will permanently delete "{formatText(debt.name)}". This action cannot be undone.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					disabled={isDeleting}
					onclick={handleDelete}
				>
					{isDeleting ? 'Deleting...' : 'Delete'}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
