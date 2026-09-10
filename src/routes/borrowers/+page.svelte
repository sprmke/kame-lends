<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import SingleSelectFilter from '$lib/components/common/SingleSelectFilter.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import BorrowersTable from '$lib/components/borrowers/BorrowersTable.svelte';
	import BorrowerCard from '$lib/components/borrowers/BorrowerCard.svelte';
	import BorrowerDetailModal from '$lib/components/borrowers/BorrowerDetailModal.svelte';
	import BorrowerCreateModal from '$lib/components/borrowers/BorrowerCreateModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { isMobileShellViewport } from '$lib/composables/use-media-query.svelte';
	import { toast } from '$lib/toast';
	import {
		LOAN_ACTIVITY_FILTER_OPTIONS,
		matchesLoanActivityFilter,
		type LoanActivityFilter
	} from '$lib/list-filters';
	import { ContactRound, PlusCircle, X } from 'lucide-svelte';
	import type { BorrowerWithLoans } from '$lib/types';

	let { data } = $props();
	const canCreate = $derived((data as { canCreate?: boolean }).canCreate !== false);
	const canManage = $derived((data as { canManage?: boolean }).canManage !== false);

	let items = $state<BorrowerWithLoans[] | null>(null);

	$effect(() => {
		let active = true;
		data.items.then((value) => {
			if (active) items = value as BorrowerWithLoans[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	let searchQuery = $state('');
	let loanActivityFilter = $state<LoanActivityFilter>('all');
	let selectedBorrower = $state<BorrowerWithLoans | null>(null);
	let showDetailModal = $state(false);
	let detailStartInEdit = $state(false);
	let showCreateModal = $state(false);
	let borrowerPendingDeletion = $state<BorrowerWithLoans | null>(null);

	onMount(() => viewModeState.init());

	async function refreshBorrowers() {
		await invalidate('app:borrowers');
		items = (await data.items) as BorrowerWithLoans[];
	}

	function handleQuickView(borrower: BorrowerWithLoans) {
		if (isMobileShellViewport()) {
			goto(`/borrowers/${borrower.id}`);
			return;
		}
		detailStartInEdit = false;
		selectedBorrower = borrower;
		showDetailModal = true;
	}

	async function openCreateModal() {
		showCreateModal = true;
	}

	function handleRowEdit(borrower: BorrowerWithLoans) {
		detailStartInEdit = true;
		selectedBorrower = borrower;
		showDetailModal = true;
	}

	async function handleRowDelete(borrower: BorrowerWithLoans) {
		const response = await fetch(`/api/borrowers/${borrower.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to delete borrower');
			throw new Error(errorData.error || 'Failed to delete borrower');
		}
		toast.success('Borrower deleted');
		await refreshBorrowers();
	}

	const hasActiveFilters = $derived(searchQuery !== '' || loanActivityFilter !== 'all');

	function clearFilters() {
		searchQuery = '';
		loanActivityFilter = 'all';
	}

	const filteredBorrowers = $derived(
		(items ?? []).filter((borrower) => {
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!borrower.name.toLowerCase().includes(q) &&
					!(borrower.email?.toLowerCase().includes(q) ?? false) &&
					!(borrower.contactNumber?.toLowerCase().includes(q) ?? false)
				) {
					return false;
				}
			}
			return matchesLoanActivityFilter(borrower.loans?.length ?? 0, loanActivityFilter);
		})
	);
</script>

<svelte:head><title>Borrowers</title></svelte:head>

{#if items === null}
	<ListPageSkeleton variant="borrowers" />
{:else}
	<DashboardPage>
		<PageHeader
			title="Borrowers"
			description="Borrowers linked to your loans"
			showPriceToggle={false}
		>
			{#if canCreate}
				<Button size="sm" aria-label="Add Borrower" onclick={openCreateModal}>
					<PlusCircle class="h-4 w-4 lg:mr-2" />
					<span class="hidden lg:inline">Add Borrower</span>
				</Button>
			{/if}
		</PageHeader>

		<ListPageToolbar
			searchValue={searchQuery}
			searchPlaceholder="Search borrowers..."
			onSearchChange={(value) => (searchQuery = value)}
			viewMode={viewModeState.viewMode}
			onViewModeChange={(mode) => viewModeState.setViewMode(mode)}
			hasData={items.length > 0}
			showViewToggle={true}
			{hasActiveFilters}
			onClearFilters={clearFilters}
		>
			{#snippet filters()}
				<SingleSelectFilter
					options={LOAN_ACTIVITY_FILTER_OPTIONS}
					value={loanActivityFilter}
					onChange={(value) => (loanActivityFilter = value as LoanActivityFilter)}
				/>
			{/snippet}
		</ListPageToolbar>

		{#if viewModeState.viewMode === 'table'}
			<BorrowersTable
				borrowers={filteredBorrowers}
				emptyMessage={(items?.length ?? 0) === 0
					? 'No borrowers yet.'
					: 'No borrowers match your filters.'}
				onQuickView={handleQuickView}
				onEdit={canManage ? handleRowEdit : undefined}
				onDelete={canManage ? (borrower) => (borrowerPendingDeletion = borrower) : undefined}
			/>
		{:else if filteredBorrowers.length === 0}
			<ListEmptyState
				message={(items?.length ?? 0) === 0
					? 'No borrowers yet'
					: 'No borrowers match your filters.'}
				icon={ContactRound}
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
			<CardPagination items={filteredBorrowers} itemsPerPage={9} itemName="borrowers">
				{#snippet children(cardBorrowers)}
					<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
						{#each cardBorrowers as borrower (borrower.id)}
							<BorrowerCard
								{borrower}
								onQuickView={() => handleQuickView(borrower)}
								onEdit={canManage ? handleRowEdit : undefined}
								onDelete={canManage ? (item) => (borrowerPendingDeletion = item) : undefined}
							/>
						{/each}
					</div>
				{/snippet}
			</CardPagination>
		{/if}
	</DashboardPage>

	<BorrowerDetailModal
		borrower={selectedBorrower}
		open={showDetailModal}
		startInEditMode={detailStartInEdit}
		onOpenChange={(open) => {
			showDetailModal = open;
			if (!open) {
				selectedBorrower = null;
				detailStartInEdit = false;
			}
		}}
		onUpdate={refreshBorrowers}
		readOnly={!canManage}
	/>

	<BorrowerCreateModal
		open={showCreateModal}
		onOpenChange={(open) => (showCreateModal = open)}
		onSuccess={refreshBorrowers}
	/>

	<ConfirmDeleteDialog
		open={borrowerPendingDeletion !== null}
		onOpenChange={(open) => {
			if (!open) borrowerPendingDeletion = null;
		}}
		title="Delete borrower?"
		description={borrowerPendingDeletion
			? `This will permanently delete "${borrowerPendingDeletion.name}".`
			: ''}
		onConfirm={async () => {
			if (borrowerPendingDeletion) await handleRowDelete(borrowerPendingDeletion);
		}}
	/>
{/if}
