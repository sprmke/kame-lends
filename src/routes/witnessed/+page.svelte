<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import LoanListMoreFiltersPanel from '$lib/components/common/LoanListMoreFiltersPanel.svelte';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import SyncCalendarButton from '$lib/components/common/SyncCalendarButton.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import LoanCard from '$lib/components/loans/LoanCard.svelte';
	import LoanProfitSummaryCards from '$lib/components/loans/LoanProfitSummaryCards.svelte';
	import LoansTable from '$lib/components/loans/LoansTable.svelte';
	import LoanCalendarView from '$lib/components/loans/LoanCalendarView.svelte';
	import LoanDetailModal from '$lib/components/loans/LoanDetailModal.svelte';
	import LoanCreateModal from '$lib/components/loans/LoanCreateModal.svelte';
	import LoanQuickPaymentDialog, {
		type LoanQuickPaymentKind
	} from '$lib/components/loans/LoanQuickPaymentDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { createLoanListParticipantFilters } from '$lib/composables/use-loan-list-participant-filters.svelte';
	import { createLoanFormOptions } from '$lib/composables/use-loan-form-options.svelte';
	import { refreshLoanList } from '$lib/composables/refresh-loan-list';
	import { refreshLoanIfCurrent } from '$lib/loan-modal-utils';
	import { isMobileShellViewport } from '$lib/composables/use-media-query.svelte';
	import { downloadLoansPdf } from '$lib/pdf-download';
	import { loanPDFSections } from '$lib/pdf-sections';
	import { createDuplicateDataFromLoan } from '$lib/loan-duplicate';
	import LoanContractDetailsModal from '$lib/components/loans/LoanContractDetailsModal.svelte';
	import { toast } from '$lib/toast';
	import {
		hasActiveLoanAmountFilters,
		matchesLoanAmountFilters
	} from '$lib/loan-list-page-filters';
	import {
		LIST_FILTER_DESKTOP_TRIGGER_CLASS,
		LOAN_STATUS_FILTER_OPTIONS,
		LOAN_TYPE_FILTER_OPTIONS
	} from '$lib/list-filters';
	import { loanListRowActionHandlers } from '$lib/components/common/action-buttons';
	import { Eye, PlusCircle, X } from 'lucide-svelte';
	import type { LoanWithInvestors } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import type { ProfitStats } from '$lib/loan-list-summary';

	let { data } = $props();
	const pageTitle = $derived((data as { pageTitle?: string }).pageTitle ?? 'Witnessed');
	const emptyMessage = $derived(
		(data as { emptyMessage?: string }).emptyMessage ?? 'No witnessed loans yet'
	);
	const canCreate = $derived((data as { canCreate?: boolean }).canCreate !== false);
	const canManage = $derived((data as { canManage?: boolean }).canManage !== false);

	let loans = $state<LoanWithInvestors[] | null>(null);
	let profitStats = $state<ProfitStats | null>(null);

	$effect(() => {
		let active = true;
		data.loans.then((value) => {
			if (active) loans = value as LoanWithInvestors[];
		});
		return () => {
			active = false;
		};
	});

	$effect(() => {
		let active = true;
		(data as { profitStats: Promise<ProfitStats> }).profitStats.then((value) => {
			if (active) profitStats = value;
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	const participantFilters = createLoanListParticipantFilters(() => loans);
	let searchQuery = $state('');
	let statusFilter = $state<string[]>([]);
	let typeFilter = $state<string[]>([]);
	let showMoreFilters = $state(false);
	let minPrincipal = $state('');
	let maxPrincipal = $state('');
	let minAvgRate = $state('');
	let maxAvgRate = $state('');
	let minInterest = $state('');
	let maxInterest = $state('');
	let minTotalAmount = $state('');
	let maxTotalAmount = $state('');
	let selectedRowIds = $state(new Set<string | number>());
	let selectedLoan = $state<LoanWithInvestors | null>(null);
	let isModalOpen = $state(false);
	let quickPaymentLoan = $state<LoanWithInvestors | null>(null);
	let quickPaymentKind = $state<LoanQuickPaymentKind | null>(null);
	let loanPendingDeletion = $state<LoanWithInvestors | null>(null);
	let contractDetailsLoan = $state<LoanWithInvestors | null>(null);
	let showContractDetailsModal = $state(false);
	let showCreateModal = $state(false);
	let createModalDuplicateData = $state<DuplicateLoanData | null>(null);
	let duplicateSourceLoanId = $state<number | null>(null);
	let detailStartInEdit = $state(false);
	const loanFormOptions = createLoanFormOptions();

	onMount(() => {
		viewModeState.init();
		void participantFilters.loadFilterOptions();
		loanFormOptions.prefetch();
	});

	function openCreateModal(duplicateData: DuplicateLoanData | null = null) {
		createModalDuplicateData = duplicateData;
		showCreateModal = true;
		void loanFormOptions.load();
	}

	function closeCreateModal() {
		showCreateModal = false;
		createModalDuplicateData = null;
		duplicateSourceLoanId = null;
	}

	async function refreshLoans() {
		loans = await refreshLoanList();
	}

	function handleQuickView(loan: LoanWithInvestors) {
		if (isMobileShellViewport()) {
			goto(`/loans/${loan.id}`);
			return;
		}
		detailStartInEdit = false;
		selectedLoan = loan;
		isModalOpen = true;
	}

	function handleRowEdit(loan: LoanWithInvestors) {
		selectedLoan = loan;
		detailStartInEdit = true;
		isModalOpen = true;
	}

	function handleRowDuplicate(loan: LoanWithInvestors) {
		duplicateSourceLoanId = loan.id;
		openCreateModal(createDuplicateDataFromLoan(loan));
		refreshLoanIfCurrent(
			() => (duplicateSourceLoanId === loan.id ? loan : null),
			(full) => {
				if (showCreateModal && duplicateSourceLoanId === full.id) {
					createModalDuplicateData = createDuplicateDataFromLoan(full);
				}
			},
			loan
		);
	}

	function handleQuickPayment(loan: LoanWithInvestors, kind: LoanQuickPaymentKind) {
		quickPaymentLoan = loan;
		quickPaymentKind = kind;
		refreshLoanIfCurrent(
			() => quickPaymentLoan,
			(full) => {
				quickPaymentLoan = full;
			},
			loan
		);
	}

	function handleRowContractDetails(loan: LoanWithInvestors) {
		contractDetailsLoan = loan;
		showContractDetailsModal = true;
		refreshLoanIfCurrent(
			() => contractDetailsLoan,
			(full) => {
				contractDetailsLoan = full;
			},
			loan
		);
	}

	async function handleContractDetailsSaved() {
		await refreshLoans();
		if (contractDetailsLoan) {
			refreshLoanIfCurrent(
				() => contractDetailsLoan,
				(full) => {
					contractDetailsLoan = full;
				},
				contractDetailsLoan
			);
		}
	}

	async function handleRowDelete(loan: LoanWithInvestors) {
		const response = await fetch(`/api/loans/${loan.id}`, { method: 'DELETE' });
		if (!response.ok) {
			toast.error('Failed to delete loan');
			throw new Error('Failed to delete loan');
		}
		toast.success('Loan deleted');
		selectedRowIds = new Set([...selectedRowIds].filter((id) => id !== loan.id));
		await refreshLoans();
	}

	const rowActions = $derived(
		loanListRowActionHandlers({
			scope: 'witnessed',
			canManage,
			onEdit: handleRowEdit,
			onDuplicate: handleRowDuplicate,
			onAddPayment: (loan) => handleQuickPayment(loan, 'payment'),
			onAddReceivedPayment: (loan) => handleQuickPayment(loan, 'received'),
			onContractDetails: handleRowContractDetails,
			onDelete: (loan) => {
				loanPendingDeletion = loan;
			}
		})
	);

	const dueDateFilter = $derived($page.url.searchParams.get('dueDate'));
	const viewParam = $derived($page.url.searchParams.get('view'));

	$effect(() => {
		if (viewParam === 'table' || viewParam === 'cards' || viewParam === 'calendar') {
			viewModeState.setViewMode(viewParam);
		}
		const statusParams = $page.url.searchParams.getAll('status');
		if (statusParams.length) statusFilter = statusParams;
		const typeParams = $page.url.searchParams.getAll('type');
		if (typeParams.length) typeFilter = typeParams;
	});

	const filteredLoans = $derived(
		(loans ?? []).filter((loan) => {
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!loan.loanName.toLowerCase().includes(q) &&
					!(loan.notes?.toLowerCase().includes(q) ?? false)
				) {
					return false;
				}
			}
			if (statusFilter.length && !statusFilter.includes(loan.status)) return false;
			if (typeFilter.length && !typeFilter.includes(loan.type)) return false;
			if (dueDateFilter) {
				const loanDue = new Date(loan.dueDate).toISOString().split('T')[0];
				if (loanDue !== dueDateFilter) return false;
			}

			if (!participantFilters.matchesParticipantFilters(loan)) return false;

			return matchesLoanAmountFilters(loan, {
				minPrincipal,
				maxPrincipal,
				minAvgRate,
				maxAvgRate,
				minInterest,
				maxInterest,
				minTotalAmount,
				maxTotalAmount
			});
		})
	);

	const sortedLoans = $derived(
		[...filteredLoans].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
	);

	const selectedLoans = $derived(sortedLoans.filter((loan) => selectedRowIds.has(loan.id)));

	const hasActiveAmountFilters = $derived(
		hasActiveLoanAmountFilters({
			minPrincipal,
			maxPrincipal,
			minAvgRate,
			maxAvgRate,
			minInterest,
			maxInterest,
			minTotalAmount,
			maxTotalAmount
		})
	);

	const hasActiveAdvancedFilters = $derived(
		hasActiveAmountFilters || participantFilters.hasActiveParticipantFilters
	);

	const hasActiveFilters = $derived(
		searchQuery !== '' ||
			statusFilter.length > 0 ||
			typeFilter.length > 0 ||
			!!dueDateFilter ||
			hasActiveAdvancedFilters
	);

	function clearFilters() {
		searchQuery = '';
		statusFilter = [];
		typeFilter = [];
		participantFilters.clearParticipantFilters();
		minPrincipal = '';
		maxPrincipal = '';
		minAvgRate = '';
		maxAvgRate = '';
		minInterest = '';
		maxInterest = '';
		minTotalAmount = '';
		maxTotalAmount = '';
	}
</script>

<svelte:head><title>Loans</title></svelte:head>

{#if loans === null}
	<ListPageSkeleton variant="loans" />
{:else}
	<DashboardPage>
		<PageHeader
			title={pageTitle}
			description="Loans where you are a witness"
			showPriceToggle={true}
		>
			<ExportButton
				data={loans}
				filteredData={sortedLoans}
				selectedData={selectedLoans}
				sections={loanPDFSections}
				onGeneratePDF={downloadLoansPdf}
			/>
			{#if canCreate}
				<SyncCalendarButton variant="outline" size="default" />
				<Button class="px-3" adaptToMobileHero onclick={() => openCreateModal()} aria-label="New Loan">
					<PlusCircle class="h-4 w-4 xl:mr-2" />
					<span class="hidden xl:inline">New Loan</span>
				</Button>
			{/if}
		</PageHeader>

		{#if profitStats && loans.length > 0}
			<LoanProfitSummaryCards stats={profitStats} />
		{/if}

		<ListPageToolbar
			searchValue={searchQuery}
			searchPlaceholder="Search loans by name or notes..."
			onSearchChange={(value) => (searchQuery = value)}
			viewMode={viewModeState.viewMode}
			onViewModeChange={viewModeState.setViewMode}
			showCalendar={true}
			hasData={loans.length > 0}
			showViewToggle={true}
			{hasActiveFilters}
			onClearFilters={clearFilters}
			{showMoreFilters}
			onToggleMoreFilters={() => (showMoreFilters = !showMoreFilters)}
			{hasActiveAdvancedFilters}
		>
			{#snippet filters()}
				<MultiSelectFilter
					options={LOAN_STATUS_FILTER_OPTIONS}
					selected={statusFilter}
					onChange={(value) => (statusFilter = value)}
					placeholder="Select Status"
					allLabel="All Status"
					triggerClassName={LIST_FILTER_DESKTOP_TRIGGER_CLASS}
				/>
				<MultiSelectFilter
					options={LOAN_TYPE_FILTER_OPTIONS}
					selected={typeFilter}
					onChange={(value) => (typeFilter = value)}
					placeholder="Select Type"
					allLabel="All Types"
					triggerClassName={LIST_FILTER_DESKTOP_TRIGGER_CLASS}
				/>
			{/snippet}
			{#snippet moreFilters()}
				<LoanListMoreFiltersPanel
					{statusFilter}
					{typeFilter}
					onStatusChange={(value) => (statusFilter = value)}
					onTypeChange={(value) => (typeFilter = value)}
					{minPrincipal}
					{maxPrincipal}
					onMinPrincipalChange={(value) => (minPrincipal = value)}
					onMaxPrincipalChange={(value) => (maxPrincipal = value)}
					{minAvgRate}
					{maxAvgRate}
					onMinAvgRateChange={(value) => (minAvgRate = value)}
					onMaxAvgRateChange={(value) => (maxAvgRate = value)}
					{minInterest}
					{maxInterest}
					onMinInterestChange={(value) => (minInterest = value)}
					onMaxInterestChange={(value) => (maxInterest = value)}
					{minTotalAmount}
					{maxTotalAmount}
					onMinTotalAmountChange={(value) => (minTotalAmount = value)}
					onMaxTotalAmountChange={(value) => (maxTotalAmount = value)}
					investorFilterOptions={participantFilters.investorFilterOptions}
					selectedInvestors={participantFilters.selectedInvestors}
					onInvestorsChange={(value) => (participantFilters.selectedInvestors = value)}
					borrowerFilterOptions={participantFilters.borrowerFilterOptions}
					selectedBorrowers={participantFilters.selectedBorrowers}
					onBorrowersChange={(value) => (participantFilters.selectedBorrowers = value)}
					witnessFilterOptions={participantFilters.witnessFilterOptions}
					selectedWitnesses={participantFilters.selectedWitnesses}
					onWitnessesChange={(value) => (participantFilters.selectedWitnesses = value)}
				/>
			{/snippet}
		</ListPageToolbar>

		{#if hasActiveFilters}
			<p class="text-sm text-muted-foreground">
				Showing {filteredLoans.length} of {loans.length} loans
			</p>
		{/if}

		{#if viewModeState.viewMode === 'table'}
			<LoansTable
				loans={sortedLoans}
				emptyMessage={loans.length === 0 ? emptyMessage : 'No loans match your filters'}
				enableRowSelection={true}
				{selectedRowIds}
				onSelectedRowIdsChange={(ids) => (selectedRowIds = ids)}
				onQuickView={handleQuickView}
				onEdit={rowActions.onEdit}
				onAddPayment={rowActions.onAddPayment}
				onAddReceivedPayment={rowActions.onAddReceivedPayment}
				onDuplicate={rowActions.onDuplicate}
				onContractDetails={rowActions.onContractDetails}
				onDelete={rowActions.onDelete}
			/>
			{#if filteredLoans.length === 0 && hasActiveFilters && loans.length > 0}
				<div class="mt-4 flex justify-center">
					<Button variant="outline" onclick={clearFilters}>
						<X class="mr-2 h-4 w-4" />
						Clear filters
					</Button>
				</div>
			{/if}
		{:else if loans.length === 0}
			<ListEmptyState message={emptyMessage} icon={Eye} />
		{:else if filteredLoans.length === 0}
			<ListEmptyState message="No loans match your filters">
				{#snippet actions()}
					<Button variant="outline" onclick={clearFilters}>
						<X class="mr-2 h-4 w-4" />
						Clear filters
					</Button>
				{/snippet}
			</ListEmptyState>
		{:else if viewModeState.viewMode === 'cards'}
			<CardPagination items={sortedLoans} itemsPerPage={9} itemName="loans">
				{#snippet children(cardLoans)}
					<div class="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
						{#each cardLoans as loan (loan.id)}
							<LoanCard
								{loan}
								onQuickView={handleQuickView}
								onEdit={rowActions.onEdit}
								onAddPayment={rowActions.onAddPayment}
								onAddReceivedPayment={rowActions.onAddReceivedPayment}
								onDuplicate={rowActions.onDuplicate}
								onContractDetails={rowActions.onContractDetails}
								onDelete={rowActions.onDelete}
							/>
						{/each}
					</div>
				{/snippet}
			</CardPagination>
		{:else}
			<LoanCalendarView loans={sortedLoans} onLoanClick={handleQuickView} />
		{/if}

		<LoanCreateModal
			open={showCreateModal}
			onOpenChange={(open) => {
				if (!open) closeCreateModal();
				else showCreateModal = true;
			}}
			investors={loanFormOptions.investors}
			borrowers={loanFormOptions.borrowers}
			duplicateData={createModalDuplicateData}
			loadingFormData={loanFormOptions.loading}
			onSuccess={refreshLoans}
		/>

		<LoanDetailModal
			loan={selectedLoan}
			open={isModalOpen}
			startInEditMode={detailStartInEdit}
			onOpenChange={(open) => {
				isModalOpen = open;
				if (!open) {
					selectedLoan = null;
					detailStartInEdit = false;
				}
			}}
			onUpdate={refreshLoans}
			onDuplicate={(duplicateData) => {
				openCreateModal(duplicateData);
			}}
			readOnly={!canManage}
		/>

		<LoanQuickPaymentDialog
			loan={quickPaymentLoan}
			kind={quickPaymentKind}
			open={canManage && quickPaymentKind !== null}
			onOpenChange={(open) => {
				if (!open) {
					quickPaymentKind = null;
					quickPaymentLoan = null;
				}
			}}
			onSuccess={refreshLoans}
		/>

		{#if contractDetailsLoan}
			<LoanContractDetailsModal
				loan={contractDetailsLoan}
				open={showContractDetailsModal}
				onOpenChange={(open) => {
					showContractDetailsModal = open;
					if (!open) contractDetailsLoan = null;
				}}
				canEdit={canManage}
				onSaved={handleContractDetailsSaved}
			/>
		{/if}

		<ConfirmDeleteDialog
			open={loanPendingDeletion !== null}
			onOpenChange={(open) => {
				if (!open) loanPendingDeletion = null;
			}}
			title="Delete Loan"
			description="Are you sure you want to delete this loan? This action cannot be undone and will remove all associated investor allocations."
			onConfirm={async () => {
				if (loanPendingDeletion) await handleRowDelete(loanPendingDeletion);
			}}
		/>
	</DashboardPage>
{/if}
