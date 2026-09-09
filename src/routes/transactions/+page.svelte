<script lang="ts">
	import { onMount } from 'svelte';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SearchFilter from '$lib/components/common/SearchFilter.svelte';
	import ViewModeToggle from '$lib/components/common/ViewModeToggle.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import TransactionsTable from '$lib/components/transactions/TransactionsTable.svelte';
	import TransactionCard from '$lib/components/transactions/TransactionCard.svelte';
	import Pagination from '$lib/components/common/Pagination.svelte';
	import { Button } from '$lib/components/ui/button';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { PlusCircle } from 'lucide-svelte';
	import type { TransactionWithInvestor } from '$lib/types';

	let { data } = $props();

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
	let cardsPage = $state(1);
	const cardsPerPage = 9;

	onMount(() => viewModeState.init());

	const filteredTransactions = $derived(
		(items ?? []).filter((transaction) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return (
				transaction.name.toLowerCase().includes(q) ||
				transaction.investor.name.toLowerCase().includes(q) ||
				(transaction.notes?.toLowerCase().includes(q) ?? false)
			);
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
		<PageHeader title="Transactions" showPriceToggle={true}>
			{#if SHOW_TRANSACTIONS_UI}
				<Button href="/transactions/new" size="sm">
					<PlusCircle class="mr-2 h-4 w-4" />
					Add Transaction
				</Button>
			{/if}
		</PageHeader>

		{#if !SHOW_TRANSACTIONS_UI}
			<p class="text-sm text-muted-foreground">
				Transactions UI is hidden. Set SHOW_TRANSACTIONS_UI to enable nav links.
			</p>
		{/if}

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<SearchFilter
				value={searchQuery}
				onChange={(value) => {
					searchQuery = value;
					cardsPage = 1;
				}}
				placeholder="Search transactions..."
			/>
			<ViewModeToggle
				viewMode={viewModeState.viewMode}
				onViewModeChange={(mode) => viewModeState.setViewMode(mode)}
			/>
		</div>

		{#if filteredTransactions.length === 0}
			<p class="text-muted-foreground">No transactions yet.</p>
		{:else if viewModeState.viewMode === 'table'}
			<TransactionsTable transactions={filteredTransactions} />
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
				itemName="transactions"
			/>
		{/if}
	</DashboardPage>
{/if}
