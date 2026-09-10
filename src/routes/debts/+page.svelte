<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import DebtsMoreFiltersPanel from '$lib/components/common/DebtsMoreFiltersPanel.svelte';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import SingleSelectFilter from '$lib/components/common/SingleSelectFilter.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import DebtsTable from '$lib/components/debts/DebtsTable.svelte';
	import DebtCard from '$lib/components/debts/DebtCard.svelte';
	import DebtDetailModal from '$lib/components/debts/DebtDetailModal.svelte';
	import DebtCreateModal from '$lib/components/debts/DebtCreateModal.svelte';
	import DebtForm from '$lib/components/debts/DebtForm.svelte';
	import EditFormSheet from '$lib/components/common/EditFormSheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { isMobileShellViewport } from '$lib/composables/use-media-query.svelte';
	import { isCompletedDebt } from '$lib/debt-calculations';
	import { toast } from '$lib/toast';
	import {
		DEBT_INTERVAL_FILTER_OPTIONS,
		LIST_FILTER_DESKTOP_TRIGGER_CLASS
	} from '$lib/list-filters';
	import { HandCoins, PlusCircle, X } from 'lucide-svelte';
	import type { DebtWithInvestor, Investor } from '$lib/types';

	const REPAYMENT_FILTER_OPTIONS = [
		{ value: 'hide', label: 'Hide Repaid' },
		{ value: 'show', label: 'Show Repaid' }
	] as const;

	let { data } = $props();
	const canCreate = $derived((data as { canCreate?: boolean }).canCreate !== false);
	const canManage = $derived((data as { canManage?: boolean }).canManage !== false);

	let items = $state<DebtWithInvestor[] | null>(null);
	let investors = $state<Pick<Investor, 'id' | 'name'>[]>([]);

	$effect(() => {
		let active = true;
		data.items.then((value) => {
			if (active) items = value as DebtWithInvestor[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	let searchQuery = $state('');
	let showPastDebts = $state(false);
	let intervalFilter = $state<string[]>([]);
	let selectedInvestors = $state<string[]>([]);
	let minAmount = $state('');
	let maxAmount = $state('');
	let showMoreFilters = $state(false);
	let selectedDebt = $state<DebtWithInvestor | null>(null);
	let showDebtModal = $state(false);
	let debtPendingDeletion = $state<DebtWithInvestor | null>(null);
	let showCreateModal = $state(false);
	let editingDebt = $state<DebtWithInvestor | null>(null);
	let editSubmitting = $state(false);

	onMount(async () => {
		viewModeState.init();
		try {
			const response = await fetch('/api/investors?simple=true');
			const investorData = await response.json();
			if (Array.isArray(investorData)) {
				investors = investorData
					.map((inv: { id: number; name: string }) => ({ id: inv.id, name: inv.name }))
					.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
			}
		} catch (error) {
			console.error('Failed to load investors', error);
		}
	});

	async function refreshDebts() {
		await invalidate('app:debts');
		items = (await data.items) as DebtWithInvestor[];
	}

	function handleQuickView(debt: DebtWithInvestor) {
		if (isMobileShellViewport()) {
			goto(`/debts/${debt.id}`);
			return;
		}
		selectedDebt = debt;
		showDebtModal = true;
	}

	function handleRowEdit(debt: DebtWithInvestor) {
		if (isMobileShellViewport()) {
			editingDebt = debt;
			return;
		}
		goto(`/debts/${debt.id}?edit=1`);
	}

	function openCreateModal() {
		if (isMobileShellViewport()) {
			showCreateModal = true;
			return;
		}
		goto('/debts/new');
	}

	async function handleRowDelete(debt: DebtWithInvestor) {
		const response = await fetch(`/api/debts/${debt.id}`, { method: 'DELETE' });
		if (!response.ok) {
			toast.error('Failed to delete borrowing');
			throw new Error('Failed to delete borrowing');
		}
		toast.success('Borrowing deleted');
		await refreshDebts();
	}

	function clearFilters() {
		searchQuery = '';
		showPastDebts = false;
		intervalFilter = [];
		selectedInvestors = [];
		minAmount = '';
		maxAmount = '';
	}

	const hasActiveAmountFilters = $derived(
		minAmount !== '' || maxAmount !== '' || selectedInvestors.length > 0
	);

	const hasActiveFilters = $derived(
		searchQuery !== '' || showPastDebts || intervalFilter.length > 0 || hasActiveAmountFilters
	);

	const filteredDebts = $derived(
		(items ?? []).filter((debt) => {
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!debt.name.toLowerCase().includes(q) &&
					!debt.investor.name.toLowerCase().includes(q) &&
					!(debt.notes?.toLowerCase().includes(q) ?? false)
				) {
					return false;
				}
			}

			if (!showPastDebts && isCompletedDebt(debt)) return false;

			if (intervalFilter.length > 0 && !intervalFilter.includes(debt.interestInterval)) {
				return false;
			}

			if (selectedInvestors.length > 0 && !selectedInvestors.includes(String(debt.investor.id))) {
				return false;
			}

			const amount = parseFloat(debt.amount);
			if (minAmount !== '' && amount < parseFloat(minAmount)) return false;
			if (maxAmount !== '' && amount > parseFloat(maxAmount)) return false;

			return true;
		})
	);

	const sortedDebts = $derived(
		[...filteredDebts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
	);

	const investorFilterOptions = $derived(
		investors.map((investor) => ({ value: String(investor.id), label: investor.name }))
	);
</script>

<svelte:head><title>Borrowings</title></svelte:head>

{#if items === null}
	<ListPageSkeleton variant="debts" />
{:else}
	<DashboardPage>
		<PageHeader
			title="Borrowings"
			description="Track borrowings and projected interest costs"
			showPriceToggle={true}
		>
			{#if canCreate}
				<Button size="sm" aria-label="Add Borrowing" onclick={openCreateModal}>
					<PlusCircle class="h-4 w-4 lg:mr-2" />
					<span class="hidden lg:inline">Add Borrowing</span>
				</Button>
			{/if}
		</PageHeader>

		<ListPageToolbar
			searchValue={searchQuery}
			searchPlaceholder="Search borrowings..."
			onSearchChange={(value) => (searchQuery = value)}
			viewMode={viewModeState.viewMode}
			onViewModeChange={(mode) => viewModeState.setViewMode(mode)}
			hasData={items.length > 0}
			showViewToggle={true}
			{hasActiveFilters}
			onClearFilters={clearFilters}
			{showMoreFilters}
			onToggleMoreFilters={() => (showMoreFilters = !showMoreFilters)}
			hasActiveAdvancedFilters={hasActiveAmountFilters}
		>
			{#snippet filters()}
				<div class={LIST_FILTER_DESKTOP_TRIGGER_CLASS}>
					<SingleSelectFilter
						options={REPAYMENT_FILTER_OPTIONS}
						value={showPastDebts ? 'show' : 'hide'}
						onChange={(value) => (showPastDebts = value === 'show')}
					/>
				</div>
				<div class="hidden shrink-0 xl:block">
					<MultiSelectFilter
						options={DEBT_INTERVAL_FILTER_OPTIONS}
						selected={intervalFilter}
						onChange={(value) => (intervalFilter = value)}
						placeholder="Accrual Period"
						allLabel="All Periods"
						triggerClassName={LIST_FILTER_DESKTOP_TRIGGER_CLASS}
					/>
				</div>
			{/snippet}
			{#snippet moreFilters()}
				<DebtsMoreFiltersPanel
					{showPastDebts}
					onShowPastDebtsChange={(value) => (showPastDebts = value)}
					{intervalFilter}
					onIntervalChange={(value) => (intervalFilter = value)}
					{minAmount}
					{maxAmount}
					onMinAmountChange={(value) => (minAmount = value)}
					onMaxAmountChange={(value) => (maxAmount = value)}
					{investorFilterOptions}
					{selectedInvestors}
					onInvestorsChange={(value) => (selectedInvestors = value)}
				/>
			{/snippet}
		</ListPageToolbar>

		{#if viewModeState.viewMode === 'table'}
			<DebtsTable
				debts={sortedDebts}
				emptyMessage={(items?.length ?? 0) === 0
					? 'No borrowings yet.'
					: 'No borrowings match your filters.'}
				onQuickView={handleQuickView}
				onEdit={canManage ? handleRowEdit : undefined}
				onDelete={canManage ? (debt) => (debtPendingDeletion = debt) : undefined}
			/>
		{:else if sortedDebts.length === 0}
			<ListEmptyState
				message={(items?.length ?? 0) === 0
					? 'No borrowings yet'
					: 'No borrowings match your filters.'}
				icon={HandCoins}
			>
				{#if hasActiveFilters}
					{#snippet actions()}
						<Button variant="outline" onclick={clearFilters}>
							<X class="mr-2 h-4 w-4" />
							Clear filters
						</Button>
					{/snippet}
				{/if}
			</ListEmptyState>
		{:else}
			<CardPagination items={sortedDebts} itemsPerPage={9} itemName="borrowings">
				{#snippet children(cardDebts)}
					<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
						{#each cardDebts as debt (debt.id)}
							<DebtCard
								{debt}
								onQuickView={() => handleQuickView(debt)}
								onEdit={canManage ? handleRowEdit : undefined}
								onDelete={canManage ? (item) => (debtPendingDeletion = item) : undefined}
							/>
						{/each}
					</div>
				{/snippet}
			</CardPagination>
		{/if}
	</DashboardPage>

	<DebtDetailModal
		debt={selectedDebt}
		open={showDebtModal}
		onOpenChange={(open) => {
			showDebtModal = open;
			if (!open) selectedDebt = null;
		}}
		onUpdate={refreshDebts}
		readOnly={!canManage}
	/>

	<DebtCreateModal
		open={showCreateModal}
		onOpenChange={(open) => (showCreateModal = open)}
		onSuccess={refreshDebts}
	/>

	<EditFormSheet
		open={editingDebt !== null}
		onOpenChange={(open) => {
			if (!open) editingDebt = null;
		}}
		title={editingDebt?.name ?? 'Borrowing'}
		formId="debt-list-edit-form"
		isSubmitting={editSubmitting}
		isEditMode={true}
		submitLabel={editSubmitting ? 'Saving...' : 'Save Changes'}
	>
		{#if editingDebt}
			<DebtForm
				investors={investors as Investor[]}
				existingDebt={editingDebt}
				formId="debt-list-edit-form"
				showFormHeader={false}
				bind:isSubmitting={editSubmitting}
				onSuccess={async () => {
					editingDebt = null;
					await refreshDebts();
				}}
				onCancel={() => (editingDebt = null)}
			/>
		{/if}
	</EditFormSheet>

	<ConfirmDeleteDialog
		open={debtPendingDeletion !== null}
		onOpenChange={(open) => {
			if (!open) debtPendingDeletion = null;
		}}
		title="Delete borrowing?"
		description={debtPendingDeletion
			? `This will permanently delete "${debtPendingDeletion.name}".`
			: ''}
		onConfirm={async () => {
			if (debtPendingDeletion) await handleRowDelete(debtPendingDeletion);
		}}
	/>
{/if}
