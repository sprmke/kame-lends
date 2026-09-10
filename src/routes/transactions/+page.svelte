<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import TransactionsTable from '$lib/components/transactions/TransactionsTable.svelte';
	import TransactionCard from '$lib/components/transactions/TransactionCard.svelte';
	import TransactionCreateModal from '$lib/components/transactions/TransactionCreateModal.svelte';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import { Button } from '$lib/components/ui/button';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { isMobileShellViewport } from '$lib/composables/use-media-query.svelte';
	import {
		LIST_FILTER_TRIGGER_CLASS,
		TRANSACTION_DIRECTION_FILTER_OPTIONS
	} from '$lib/list-filters';
	import { ArrowLeftRight, PlusCircle, X } from 'lucide-svelte';
	import type { TransactionWithInvestor } from '$lib/types';

	let { data } = $props();
	const canCreate = $derived((data as { canCreate?: boolean }).canCreate !== false);

	let items = $state<TransactionWithInvestor[] | null>(null);

	$effect(() => {
		let active = true;
		data.items.then((value) => {
			if (active) items = value as TransactionWithInvestor[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	let searchQuery = $state('');
	let directionFilter = $state<string[]>([]);
	let selectedInvestors = $state<string[]>([]);
	let cardsPage = $state(1);
	let cardsPerPage = $state(9);
	let showCreateModal = $state(false);

	onMount(() => viewModeState.init());

	const hasActiveFilters = $derived(
		searchQuery !== '' || directionFilter.length > 0 || selectedInvestors.length > 0
	);

	function clearFilters() {
		searchQuery = '';
		directionFilter = [];
		selectedInvestors = [];
		cardsPage = 1;
	}

	const investorFilterOptions = $derived(
		Array.from(
			(items ?? [])
				.reduce((map, transaction) => {
					if (!map.has(transaction.investor.id)) {
						map.set(transaction.investor.id, {
							value: String(transaction.investor.id),
							label: transaction.investor.name
						});
					}
					return map;
				}, new Map<number, { value: string; label: string }>())
				.values()
		).sort((a, b) => a.label.localeCompare(b.label))
	);

	const filteredTransactions = $derived(
		(items ?? []).filter((transaction) => {
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!transaction.name.toLowerCase().includes(q) &&
					!transaction.investor.name.toLowerCase().includes(q) &&
					!(transaction.notes?.toLowerCase().includes(q) ?? false)
				) {
					return false;
				}
			}
			if (directionFilter.length > 0 && !directionFilter.includes(transaction.direction)) {
				return false;
			}
			if (
				selectedInvestors.length > 0 &&
				!selectedInvestors.includes(String(transaction.investor.id))
			) {
				return false;
			}
			return true;
		})
	);

	const cardsTotalPages = $derived(
		Math.max(1, Math.ceil(filteredTransactions.length / cardsPerPage))
	);
	const cardTransactions = $derived(
		filteredTransactions.slice((cardsPage - 1) * cardsPerPage, cardsPage * cardsPerPage)
	);
</script>

<svelte:head><title>Transactions</title></svelte:head>

{#if items === null}
	<ListPageSkeleton variant="transactions" />
{:else}
	<DashboardPage>
		<PageHeader
			title="Transactions"
			description="View and manage all transactions"
			showPriceToggle={true}
		>
			{#if SHOW_TRANSACTIONS_UI && canCreate}
				<Button
					size="sm"
					adaptToMobileHero
					aria-label="Add Transaction"
					onclick={() => {
						if (isMobileShellViewport()) {
							showCreateModal = true;
							return;
						}
						void goto('/transactions/new');
					}}
				>
					<PlusCircle class="h-4 w-4 lg:mr-2" />
					<span class="hidden lg:inline">Add Transaction</span>
				</Button>
			{/if}
		</PageHeader>

		{#if !SHOW_TRANSACTIONS_UI}
			<p class="text-sm text-muted-foreground">
				Transactions UI is hidden. Set SHOW_TRANSACTIONS_UI to enable nav links.
			</p>
		{/if}

		<ListPageToolbar
			searchValue={searchQuery}
			searchPlaceholder="Search transactions..."
			onSearchChange={(value) => {
				searchQuery = value;
				cardsPage = 1;
			}}
			viewMode={viewModeState.viewMode}
			onViewModeChange={(mode) => viewModeState.setViewMode(mode)}
			hasData={(items?.length ?? 0) > 0}
			showViewToggle={true}
			{hasActiveFilters}
			onClearFilters={clearFilters}
		>
			{#snippet filters()}
				<MultiSelectFilter
					options={TRANSACTION_DIRECTION_FILTER_OPTIONS}
					selected={directionFilter}
					onChange={(value) => {
						directionFilter = value;
						cardsPage = 1;
					}}
					placeholder="Direction"
					allLabel="All Directions"
					triggerClassName={LIST_FILTER_TRIGGER_CLASS}
				/>
				{#if investorFilterOptions.length > 0}
					<MultiSelectFilter
						options={investorFilterOptions}
						selected={selectedInvestors}
						onChange={(value) => {
							selectedInvestors = value;
							cardsPage = 1;
						}}
						placeholder="All Investors"
						allLabel="All Investors"
						searchPlaceholder="Search investors..."
						searchable={true}
						triggerClassName={LIST_FILTER_TRIGGER_CLASS}
					/>
				{/if}
			{/snippet}
		</ListPageToolbar>

		{#if viewModeState.viewMode === 'table'}
			<TransactionsTable
				transactions={filteredTransactions}
				emptyMessage={(items?.length ?? 0) === 0
					? 'No transactions yet.'
					: 'No transactions match your filters.'}
			/>
		{:else if filteredTransactions.length === 0}
			<ListEmptyState
				message={(items?.length ?? 0) === 0
					? 'No transactions yet'
					: 'No transactions match your filters.'}
				icon={ArrowLeftRight}
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
			<div class="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
				{#each cardTransactions as transaction (transaction.id)}
					<TransactionCard {transaction} />
				{/each}
			</div>
			<Pagination
				currentPage={cardsPage}
				totalPages={cardsTotalPages}
				onPageChange={(page) => (cardsPage = page)}
				startIndex={(cardsPage - 1) * cardsPerPage}
				endIndex={Math.min(cardsPage * cardsPerPage, filteredTransactions.length)}
				totalItems={filteredTransactions.length}
				itemName="transactions"
				itemsPerPage={cardsPerPage}
				itemsPerPageOptions={[9, 12, 15, 20, 50]}
				onItemsPerPageChange={(value) => {
					cardsPerPage = value;
					cardsPage = 1;
				}}
			/>
		{/if}
	</DashboardPage>

	<TransactionCreateModal
		open={showCreateModal}
		onOpenChange={(open) => (showCreateModal = open)}
		onSuccess={async () => {
			await invalidate('app:transactions');
			items = (await data.items) as TransactionWithInvestor[];
		}}
	/>
{/if}
