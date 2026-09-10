<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import SingleSelectFilter from '$lib/components/common/SingleSelectFilter.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import InvestorsTable from '$lib/components/investors/InvestorsTable.svelte';
	import InvestorCard from '$lib/components/investors/InvestorCard.svelte';
	import InvestorFormModal from '$lib/components/investors/InvestorFormModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { isMobileShellViewport } from '$lib/composables/use-media-query.svelte';
	import {
		LOAN_ACTIVITY_FILTER_OPTIONS,
		matchesLoanActivityFilter,
		type LoanActivityFilter
	} from '$lib/list-filters';
	import { toast } from '$lib/toast';
	import { PlusCircle, Users, X } from 'lucide-svelte';
	import { downloadInvestorsPdf } from '$lib/pdf-download';
	import { investorPDFSections } from '$lib/pdf-sections';
	import type { InvestorWithLoans } from '$lib/types';

	let { data } = $props();
	const canCreate = $derived((data as { canCreate?: boolean }).canCreate !== false);
	const canManage = $derived((data as { canManage?: boolean }).canManage !== false);

	let items = $state<InvestorWithLoans[] | null>(null);

	$effect(() => {
		let active = true;
		data.items.then((value) => {
			if (active) items = value as unknown as InvestorWithLoans[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	let searchQuery = $state('');
	let loanActivityFilter = $state<LoanActivityFilter>('all');
	let investorPendingDeletion = $state<InvestorWithLoans | null>(null);
	let showFormModal = $state(false);
	let editingInvestor = $state<InvestorWithLoans | null>(null);

	onMount(() => viewModeState.init());

	async function refreshInvestors() {
		await invalidate('app:investors');
		items = (await data.items) as InvestorWithLoans[];
	}

	function handleQuickView(investor: InvestorWithLoans) {
		goto(`/investors/${investor.id}`);
	}

	function handleRowEdit(investor: InvestorWithLoans) {
		if (isMobileShellViewport()) {
			editingInvestor = investor;
			showFormModal = true;
			return;
		}
		goto(`/investors/${investor.id}`);
	}

	function openCreateModal() {
		if (isMobileShellViewport()) {
			editingInvestor = null;
			showFormModal = true;
			return;
		}
		goto('/investors/new');
	}

	async function handleRowDelete(investor: InvestorWithLoans) {
		const response = await fetch(`/api/investors/${investor.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to delete investor');
			throw new Error(errorData.error || 'Failed to delete investor');
		}
		toast.success('Investor deleted');
		await refreshInvestors();
	}

	const hasActiveFilters = $derived(searchQuery !== '' || loanActivityFilter !== 'all');

	function clearFilters() {
		searchQuery = '';
		loanActivityFilter = 'all';
	}

	const filteredInvestors = $derived(
		(items ?? []).filter((investor) => {
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!investor.name.toLowerCase().includes(q) &&
					!investor.email.toLowerCase().includes(q)
				) {
					return false;
				}
			}
			return matchesLoanActivityFilter(investor.loanInvestors.length, loanActivityFilter);
		})
	);
</script>

<svelte:head><title>Investors</title></svelte:head>

{#if items === null}
	<ListPageSkeleton variant="investors" />
{:else}
	<DashboardPage>
		<PageHeader
			title="Investors"
			description="Track investor portfolios and balances"
			showPriceToggle={true}
		>
			{#if items.length > 0}
				<ExportButton
					data={items}
					filteredData={filteredInvestors}
					sections={investorPDFSections}
					onGeneratePDF={downloadInvestorsPdf}
				/>
			{/if}
			{#if canCreate}
				<Button size="sm" aria-label="Add Investor" onclick={openCreateModal}>
					<PlusCircle class="h-4 w-4 lg:mr-2" />
					<span class="hidden lg:inline">Add Investor</span>
				</Button>
			{/if}
		</PageHeader>

		<ListPageToolbar
			searchValue={searchQuery}
			searchPlaceholder="Search investors..."
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
			<InvestorsTable
				investors={filteredInvestors}
				emptyMessage={(items?.length ?? 0) === 0
					? 'No investors yet.'
					: 'No investors match your filters.'}
				onQuickView={handleQuickView}
				onEdit={canManage ? handleRowEdit : undefined}
				onDelete={canManage ? (investor) => (investorPendingDeletion = investor) : undefined}
			/>
		{:else if filteredInvestors.length === 0}
			<ListEmptyState
				message={(items?.length ?? 0) === 0
					? 'No investors yet'
					: 'No investors match your filters.'}
				icon={Users}
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
			<CardPagination items={filteredInvestors} itemsPerPage={9} itemName="investors">
				{#snippet children(cardInvestors)}
					<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
						{#each cardInvestors as investor (investor.id)}
							<InvestorCard
								{investor}
								onQuickView={handleQuickView}
								onEdit={canManage ? handleRowEdit : undefined}
								onDelete={canManage ? (item) => (investorPendingDeletion = item) : undefined}
							/>
						{/each}
					</div>
				{/snippet}
			</CardPagination>
		{/if}
	</DashboardPage>

	<InvestorFormModal
		open={showFormModal}
		existingInvestor={editingInvestor}
		onOpenChange={(open) => {
			showFormModal = open;
			if (!open) editingInvestor = null;
		}}
		onSuccess={async () => {
			editingInvestor = null;
			await refreshInvestors();
		}}
	/>

	<ConfirmDeleteDialog
		open={investorPendingDeletion !== null}
		onOpenChange={(open) => {
			if (!open) investorPendingDeletion = null;
		}}
		title="Delete investor?"
		description={investorPendingDeletion
			? `This will permanently delete "${investorPendingDeletion.name}".`
			: ''}
		onConfirm={async () => {
			if (investorPendingDeletion) await handleRowDelete(investorPendingDeletion);
		}}
	/>
{/if}
