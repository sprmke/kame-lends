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
	import WitnessesTable from '$lib/components/witnesses/WitnessesTable.svelte';
	import WitnessCard from '$lib/components/witnesses/WitnessCard.svelte';
	import WitnessDetailModal from '$lib/components/witnesses/WitnessDetailModal.svelte';
	import WitnessCreateModal from '$lib/components/witnesses/WitnessCreateModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { isMobileShellViewport } from '$lib/composables/use-media-query.svelte';
	import { toast } from '$lib/toast';
	import { countWitnessedLoans } from '$lib/witness-loans';
	import {
		LOAN_ACTIVITY_FILTER_OPTIONS,
		matchesLoanActivityFilter,
		matchesWitnessSigningFilter,
		WITNESS_SIGNING_FILTER_OPTIONS,
		type LoanActivityFilter,
		type WitnessSigningFilter
	} from '$lib/list-filters';
	import { PlusCircle, UserCheck, X } from 'lucide-svelte';
	import type { WitnessWithLoans } from '$lib/types';

	let { data } = $props();
	const canCreate = $derived((data as { canCreate?: boolean }).canCreate !== false);
	const canManage = $derived((data as { canManage?: boolean }).canManage !== false);

	let items = $state<WitnessWithLoans[] | null>(null);

	$effect(() => {
		let active = true;
		data.items.then((value) => {
			if (active) items = value as WitnessWithLoans[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	let searchQuery = $state('');
	let loanActivityFilter = $state<LoanActivityFilter>('all');
	let signingFilter = $state<WitnessSigningFilter>('all');
	let selectedWitness = $state<WitnessWithLoans | null>(null);
	let showDetailModal = $state(false);
	let detailStartInEdit = $state(false);
	let showCreateModal = $state(false);
	let witnessPendingDeletion = $state<WitnessWithLoans | null>(null);

	onMount(() => viewModeState.init());

	async function refreshWitnesses() {
		await invalidate('app:witnesses');
		items = (await data.items) as WitnessWithLoans[];
	}

	function handleQuickView(witness: WitnessWithLoans) {
		if (isMobileShellViewport()) {
			goto(`/witnesses/${witness.id}`);
			return;
		}
		detailStartInEdit = false;
		selectedWitness = witness;
		showDetailModal = true;
	}

	async function openCreateModal() {
		showCreateModal = true;
	}

	function handleRowEdit(witness: WitnessWithLoans) {
		detailStartInEdit = true;
		selectedWitness = witness;
		showDetailModal = true;
	}

	async function handleRowDelete(witness: WitnessWithLoans) {
		const response = await fetch(`/api/witnesses/${witness.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			toast.error(errorData.error || 'Failed to delete witness');
			throw new Error(errorData.error || 'Failed to delete witness');
		}
		toast.success('Witness deleted');
		await refreshWitnesses();
	}

	const hasActiveFilters = $derived(
		searchQuery !== '' || loanActivityFilter !== 'all' || signingFilter !== 'all'
	);

	function clearFilters() {
		searchQuery = '';
		loanActivityFilter = 'all';
		signingFilter = 'all';
	}

	const filteredWitnesses = $derived(
		(items ?? []).filter((witness) => {
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!witness.name.toLowerCase().includes(q) &&
					!(witness.email?.toLowerCase().includes(q) ?? false) &&
					!(witness.contactNumber?.toLowerCase().includes(q) ?? false)
				) {
					return false;
				}
			}
			if (!matchesLoanActivityFilter(countWitnessedLoans(witness), loanActivityFilter)) {
				return false;
			}
			return matchesWitnessSigningFilter(witness.signingInvitations ?? [], signingFilter);
		})
	);
</script>

<svelte:head><title>Witnesses</title></svelte:head>

{#if items === null}
	<ListPageSkeleton variant="witnesses" />
{:else}
	<DashboardPage>
		<PageHeader
			title="Witnesses"
			description="Contract witnesses for your loans"
			showPriceToggle={false}
		>
			{#if canCreate}
				<Button size="sm" aria-label="Add Witness" onclick={openCreateModal}>
					<PlusCircle class="h-4 w-4 lg:mr-2" />
					<span class="hidden lg:inline">Add Witness</span>
				</Button>
			{/if}
		</PageHeader>

		<ListPageToolbar
			searchValue={searchQuery}
			searchPlaceholder="Search witnesses..."
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
				<SingleSelectFilter
					options={WITNESS_SIGNING_FILTER_OPTIONS}
					value={signingFilter}
					onChange={(value) => (signingFilter = value as WitnessSigningFilter)}
				/>
			{/snippet}
		</ListPageToolbar>

		{#if viewModeState.viewMode === 'table'}
			<WitnessesTable
				witnesses={filteredWitnesses}
				emptyMessage={(items?.length ?? 0) === 0
					? 'No witnesses yet.'
					: 'No witnesses match your filters.'}
				onQuickView={handleQuickView}
				onEdit={canManage ? handleRowEdit : undefined}
				onDelete={canManage ? (witness) => (witnessPendingDeletion = witness) : undefined}
			/>
		{:else if filteredWitnesses.length === 0}
			<ListEmptyState
				message={(items?.length ?? 0) === 0
					? 'No witnesses yet'
					: 'No witnesses match your filters.'}
				icon={UserCheck}
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
			<CardPagination items={filteredWitnesses} itemsPerPage={9} itemName="witnesses">
				{#snippet children(cardWitnesses)}
					<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
						{#each cardWitnesses as witness (witness.id)}
							<WitnessCard
								{witness}
								onQuickView={() => handleQuickView(witness)}
								onEdit={canManage ? handleRowEdit : undefined}
								onDelete={canManage ? (item) => (witnessPendingDeletion = item) : undefined}
							/>
						{/each}
					</div>
				{/snippet}
			</CardPagination>
		{/if}
	</DashboardPage>

	<WitnessDetailModal
		witness={selectedWitness}
		open={showDetailModal}
		startInEditMode={detailStartInEdit}
		onOpenChange={(open) => {
			showDetailModal = open;
			if (!open) {
				selectedWitness = null;
				detailStartInEdit = false;
			}
		}}
		onUpdate={refreshWitnesses}
		readOnly={!canManage}
	/>

	<WitnessCreateModal
		open={showCreateModal}
		onOpenChange={(open) => (showCreateModal = open)}
		onSuccess={refreshWitnesses}
	/>

	<ConfirmDeleteDialog
		open={witnessPendingDeletion !== null}
		onOpenChange={(open) => {
			if (!open) witnessPendingDeletion = null;
		}}
		title="Delete witness?"
		description={witnessPendingDeletion
			? `This will permanently delete "${witnessPendingDeletion.name}".`
			: ''}
		onConfirm={async () => {
			if (witnessPendingDeletion) await handleRowDelete(witnessPendingDeletion);
		}}
	/>
{/if}
