<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import LoanListMoreFiltersPanel from '$lib/components/common/LoanListMoreFiltersPanel.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import LoanCard from '$lib/components/loans/LoanCard.svelte';
	import LoanCommissionSummaryCards from '$lib/components/loans/LoanCommissionSummaryCards.svelte';
	import LoansTable from '$lib/components/loans/LoansTable.svelte';
	import LoanCalendarView from '$lib/components/loans/LoanCalendarView.svelte';
	import LoanDetailModal from '$lib/components/loans/LoanDetailModal.svelte';
	import LoanCreateModal from '$lib/components/loans/LoanCreateModal.svelte';
	import LoanQuickPaymentDialog, {
		type LoanQuickPaymentKind
	} from '$lib/components/loans/LoanQuickPaymentDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import {
		createIsMobileShell,
		isMobileShellViewport
	} from '$lib/composables/use-media-query.svelte';
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
		computeLoanListSummaryStats,
		computePartyCommissionStats,
		loanHasPartyCommission,
		passesLoanDueDateRangeFilter
	} from '$lib/loan-list-summary';
	import DateRangeFilter from '$lib/components/common/DateRangeFilter.svelte';
	import LoanListSummaryCards from '$lib/components/loans/LoanListSummaryCards.svelte';
	import { createLoanListDateRange } from '$lib/composables/use-loan-list-date-range.svelte';
	import { createLoanListParticipantFilters } from '$lib/composables/use-loan-list-participant-filters.svelte';
	import { createLoanFormOptions } from '$lib/composables/use-loan-form-options.svelte';
	import { applyLoanListChange, refreshLoanList } from '$lib/composables/refresh-loan-list';
	import type { LoanListChange } from '$lib/composables/refresh-loan-list';
	import { refreshLoanIfCurrent } from '$lib/loan-modal-utils';
	import { loanListRowActionHandlers } from '$lib/components/common/action-buttons';
	import { PlusCircle, X } from 'lucide-svelte';
	import type { LoanWithInvestors } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import GroupScopedFilterInfo from '$lib/components/groups/GroupScopedFilterInfo.svelte';
	import LoanGroupFilter from '$lib/components/loans/LoanGroupFilter.svelte';
	import LoanBulkActionBar from '$lib/components/loans/LoanBulkActionBar.svelte';
	import { SHOW_GROUPS_UI } from '$lib/feature-flags';
	import { createLoanListGroupScope } from '$lib/composables/use-loan-list-group-scope.svelte';
	import AccessPreview from '$lib/components/groups/AccessPreview.svelte';
	import type { AccessPreviewData } from '$lib/components/groups/types';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';

	import {
		LOAN_LIST_PAGE_VARIANTS,
		type LoanListPageScope
	} from '$lib/components/loans/loan-list-page-config';
	import LoanScopeTabs from '$lib/components/loans/LoanScopeTabs.svelte';

	type GroupListContext = { groupId: number };

	let {
		data,
		scope,
		groupContext = null,
		showScopeTabs = false
	}: {
		// Accept full page load (layout fields + list fields).
		data: {
			loans: Promise<unknown> | LoanWithInvestors[];
			pageTitle?: string;
			emptyMessage?: string;
			canCreate?: boolean;
			canManage?: boolean;
			userId?: string;
			myInvestorIds?: number[];
			myWitnessIds?: number[];
			[key: string]: unknown;
		};
		scope: LoanListPageScope;
		groupContext?: GroupListContext | null;
		showScopeTabs?: boolean;
	} = $props();

	const variant = $derived(LOAN_LIST_PAGE_VARIANTS[scope]);
	const pageTitle = $derived(data.pageTitle ?? variant.defaultPageTitle);
	const emptyMessage = $derived(data.emptyMessage ?? variant.defaultEmptyMessage);
	const canCreate = $derived(data.canCreate !== false);
	const canManage = $derived(data.canManage !== false);
	const emptyIcon = $derived(variant.emptyIcon);

	let loans = $state<LoanWithInvestors[] | null>(
		Array.isArray(data.loans) ? (data.loans as LoanWithInvestors[]) : null
	);
	let loanPendingRemoval = $state<LoanWithInvestors | null>(null);
	let removePreview = $state<AccessPreviewData | null>(null);
	let removePreviewLoading = $state(false);
	let removePreviewError = $state<string | null>(null);
	let isRemovingLoan = $state(false);
	const listLoans = $derived(loans ?? []);

	$effect(() => {
		const source = data.loans;
		if (Array.isArray(source)) {
			loans = source as LoanWithInvestors[];
			return;
		}
		let active = true;
		source.then((value) => {
			if (active) loans = value as LoanWithInvestors[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	const isMobileShell = createIsMobileShell(false);
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
	let phoneSelectMode = $state(false);
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
	let detailStartCommissionEdit = $state(false);
	const loanFormOptions = createLoanFormOptions();

	const groupScope = createLoanListGroupScope({
		getLoans: () => loans,
		showUngrouped: () => scope === 'loans' && canManage,
		scopeNoun: LOAN_LIST_PAGE_VARIANTS[scope].groupScopeNoun
	});

	onMount(() => {
		viewModeState.init();
		if (variant.showDateRange) isMobileShell.init();
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

	async function refreshLoans(change?: LoanListChange) {
		const depends = variant.listInvalidate;
		if (!loans) {
			loans = await refreshLoanList(depends);
			return;
		}
		loans = await applyLoanListChange(loans, change ?? { kind: 'reload' }, { depends });
	}

	function handleQuickView(loan: LoanWithInvestors) {
		if (isMobileShellViewport()) {
			goto(`/loans/${loan.id}`);
			return;
		}
		detailStartInEdit = false;
		detailStartCommissionEdit = false;
		selectedLoan = loan;
		isModalOpen = true;
	}

	function handleRowEdit(loan: LoanWithInvestors) {
		selectedLoan = loan;
		detailStartInEdit = true;
		detailStartCommissionEdit = false;
		isModalOpen = true;
	}

	function handleRowAddCommission(loan: LoanWithInvestors) {
		if (isMobileShellViewport()) {
			goto(`/loans/${loan.id}?commission=1`);
			return;
		}
		detailStartInEdit = false;
		detailStartCommissionEdit = true;
		selectedLoan = loan;
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

	function handleContractDetailsOpenChange(open: boolean) {
		showContractDetailsModal = open;
	}

	function handleContractDetailsOpenChangeComplete(open: boolean) {
		if (!open) contractDetailsLoan = null;
	}

	function handleRowContractDetails(loan: LoanWithInvestors) {
		contractDetailsLoan = loan;
		showContractDetailsModal = true;
		refreshLoanIfCurrent(
			() => contractDetailsLoan,
			(full) => {
				contractDetailsLoan = full;
			},
			loan,
			{ includeContract: true }
		);
	}

	async function handleContractDetailsSaved() {
		const current = contractDetailsLoan;
		if (!current) {
			await refreshLoans();
			return;
		}
		await refreshLoans({ kind: 'upsert', loanId: current.id });
		refreshLoanIfCurrent(
			() => contractDetailsLoan,
			(full) => {
				contractDetailsLoan = full;
			},
			current,
			{ includeContract: true }
		);
	}

	async function handleRowDelete(loan: LoanWithInvestors) {
		const response = await fetch(`/api/loans/${loan.id}`, { method: 'DELETE' });
		if (!response.ok) {
			toast.error('Failed to delete loan');
			throw new Error('Failed to delete loan');
		}
		toast.success('Loan deleted');
		selectedRowIds = new Set([...selectedRowIds].filter((id) => id !== loan.id));
		await refreshLoans({ kind: 'remove', loanId: loan.id });
	}

	async function openRemoveFromGroup(loan: LoanWithInvestors) {
		if (!groupContext) return;
		loanPendingRemoval = loan;
		removePreview = null;
		removePreviewError = null;
		removePreviewLoading = true;
		try {
			const response = await fetch(`/api/groups/${groupContext.groupId}/access-preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ removeLoanIds: [loan.id] })
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Preview failed');
			}
			removePreview = (await response.json()) as AccessPreviewData;
		} catch (error) {
			removePreviewError = error instanceof Error ? error.message : 'Preview failed';
		} finally {
			removePreviewLoading = false;
		}
	}

	async function handleRemoveFromGroup() {
		if (!groupContext || !loanPendingRemoval) return;
		isRemovingLoan = true;
		try {
			const response = await fetch(
				`/api/groups/${groupContext.groupId}/loans/${loanPendingRemoval.id}`,
				{ method: 'DELETE' }
			);
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				toast.error(errorData.error || 'Failed to remove loan');
				return;
			}
			toast.success('Loan removed');
			const removedId = loanPendingRemoval.id;
			loanPendingRemoval = null;
			selectedRowIds = new Set([...selectedRowIds].filter((id) => id !== removedId));
			await refreshLoans({ kind: 'remove', loanId: removedId });
		} finally {
			isRemovingLoan = false;
		}
	}

	const rowActions = $derived(
		loanListRowActionHandlers({
			scope,
			canManage,
			showAddCommission: variant.showCommissionSummary,
			onEdit: handleRowEdit,
			onDuplicate: handleRowDuplicate,
			onAddPayment: (loan) => handleQuickPayment(loan, 'payment'),
			onAddReceivedPayment: (loan) => handleQuickPayment(loan, 'received'),
			onContractDetails: handleRowContractDetails,
			onAddCommission: handleRowAddCommission,
			onDelete: (loan) => {
				loanPendingDeletion = loan;
			},
			onRemoveFromGroup: groupContext ? openRemoveFromGroup : undefined
		})
	);

	const dueDateFilter = $derived(page.url.searchParams.get('dueDate'));
	const viewParam = $derived(page.url.searchParams.get('view'));
	const dateRangeState = createLoanListDateRange(() => page, () => ({
		enabled: LOAN_LIST_PAGE_VARIANTS[scope].showDateRange,
		defaultPreset: LOAN_LIST_PAGE_VARIANTS[scope].defaultDatePreset
	}));
	const filterFrom = $derived(dateRangeState.filterFrom);
	const filterTo = $derived(dateRangeState.filterTo);

	$effect(() => {
		if (viewParam === 'table' || viewParam === 'cards' || viewParam === 'calendar') {
			viewModeState.setViewMode(viewParam);
		}
		const statusParams = page.url.searchParams.getAll('status');
		if (statusParams.length) statusFilter = statusParams;
		const typeParams = page.url.searchParams.getAll('type');
		if (typeParams.length) typeFilter = typeParams;
	});

	const partyCommissionContext = $derived(
		data.userId
			? {
					userId: data.userId,
					investorIds: data.myInvestorIds ?? [],
					witnessIds: data.myWitnessIds ?? []
				}
			: null
	);

	const scopeBaseLoans = $derived.by(() => {
		const list = loans ?? [];
		if (scope !== 'commissioned' || !partyCommissionContext) return list;
		return list.filter((loan) => loanHasPartyCommission(loan, partyCommissionContext));
	});

	const preGroupLoans = $derived(
		variant.showDateRange
			? scopeBaseLoans.filter((loan) => passesLoanDueDateRangeFilter(loan, filterFrom, filterTo))
			: scopeBaseLoans
	);

	const scopedLoans = $derived(
		scope === 'group' ? preGroupLoans : groupScope.applyGroupFilter(preGroupLoans)
	);

	const showGroupFilter = $derived(
		!variant.embedded && scope !== 'group' && groupScope.showGroupBar
	);

	const summaryStats = $derived(
		variant.showLoanListSummary
			? computeLoanListSummaryStats(scopedLoans, filterFrom, filterTo)
			: null
	);

	const commissionStats = $derived(
		variant.showCommissionSummary && scopedLoans.length > 0 && partyCommissionContext
			? computePartyCommissionStats(
					scopedLoans,
					partyCommissionContext,
					filterFrom,
					filterTo
				)
			: null
	);

	const filteredLoans = $derived(
		scopedLoans.filter((loan) => {
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
		statusFilter.length > 0 ||
			hasActiveAmountFilters ||
			participantFilters.hasActiveParticipantFilters ||
			typeFilter.length > 0
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
		if (variant.showDateRange) {
			dateRangeState.clearDateFilter();
			const url = new URL(page.url);
			url.searchParams.delete('dueDate');
			replaceState(`${url.pathname}${url.search}`, page.state);
		}
	}
</script>

<svelte:head>
	{#if !variant.embedded}
		<title>{variant.documentTitle}</title>
	{/if}
</svelte:head>

{#if loans === null}
	<ListPageSkeleton variant="loans" embedded={variant.embedded} />
{:else if variant.embedded}
	<div class="space-y-4">
		{@render listChrome()}
	</div>
{:else}
	<DashboardPage>
		{@render listChrome()}
	</DashboardPage>
{/if}

{#snippet listChrome()}
		{#if !variant.embedded}
		<PageHeader title={pageTitle} description={variant.description} showPriceToggle={true}>
			{#if variant.showDateRange && !isMobileShell.matches}
				<DateRangeFilter
					dateRange={dateRangeState.dateRange}
					datePreset={dateRangeState.datePreset}
					isActive={dateRangeState.isDateFilterActive}
					setDatePreset={dateRangeState.setDatePreset}
					setDateRange={dateRangeState.setDateRange}
					navigatePeriod={dateRangeState.navigatePeriod}
					goToToday={dateRangeState.goToToday}
					onClear={dateRangeState.clearDateFilter}
				/>
			{/if}
			<ExportButton
				data={listLoans}
				filteredData={sortedLoans}
				selectedData={selectedLoans}
				sections={loanPDFSections}
				onGeneratePDF={downloadLoansPdf}
			/>
			{#if canCreate}
				<Button class="px-3" adaptToMobileHero onclick={() => openCreateModal()} aria-label="New Loan">
					<PlusCircle class="h-4 w-4 xl:mr-2" />
					<span class="hidden xl:inline">New Loan</span>
				</Button>
			{/if}
		</PageHeader>
		{/if}

		{#if showScopeTabs && !variant.embedded}
			<LoanScopeTabs />
		{/if}

		{#if variant.embedded && variant.showDateRange}
			<div class="flex items-center gap-2 sm:justify-between">
				<div class={isMobileShell.matches ? 'min-w-0 flex-1' : ''}>
					<DateRangeFilter
						dateRange={dateRangeState.dateRange}
						datePreset={dateRangeState.datePreset}
						isActive={dateRangeState.isDateFilterActive}
						fullWidth={isMobileShell.matches}
						setDatePreset={dateRangeState.setDatePreset}
						setDateRange={dateRangeState.setDateRange}
						navigatePeriod={dateRangeState.navigatePeriod}
						goToToday={dateRangeState.goToToday}
						onClear={dateRangeState.clearDateFilter}
					/>
				</div>
				{#if !isMobileShell.matches}
					<ExportButton
						data={listLoans}
						filteredData={sortedLoans}
						selectedData={selectedLoans}
						sections={loanPDFSections}
						onGeneratePDF={downloadLoansPdf}
					/>
				{/if}
			</div>
		{/if}

		{#if !variant.embedded && variant.showDateRange && isMobileShell.matches}
			<DateRangeFilter
				dateRange={dateRangeState.dateRange}
				datePreset={dateRangeState.datePreset}
				isActive={dateRangeState.isDateFilterActive}
				fullWidth={true}
				setDatePreset={dateRangeState.setDatePreset}
				setDateRange={dateRangeState.setDateRange}
				navigatePeriod={dateRangeState.navigatePeriod}
				goToToday={dateRangeState.goToToday}
				onClear={dateRangeState.clearDateFilter}
			/>
		{/if}

		{#if variant.showLoanListSummary && scopedLoans.length > 0 && summaryStats}
			<LoanListSummaryCards stats={summaryStats} />
		{/if}

		{#if variant.showCommissionSummary && commissionStats}
			<LoanCommissionSummaryCards stats={commissionStats} />
		{/if}

		{#if variant.showGroupScopedInfo && groupScope.selectedGroupInfo}
			<GroupScopedFilterInfo
				count={groupScope.selectedGroupInfo.countOnPage}
				scopeNoun={groupScope.scopeNoun}
				groupName={groupScope.selectedGroupInfo.name}
				groupId={groupScope.selectedGroupInfo.id}
			/>
		{/if}

		<ListPageToolbar
			searchValue={searchQuery}
			searchPlaceholder="Search loans by name or notes..."
			onSearchChange={(value) => (searchQuery = value)}
			viewMode={viewModeState.viewMode}
			onViewModeChange={viewModeState.setViewMode}
			showCalendar={true}
			hasData={listLoans.length > 0}
			showViewToggle={true}
			{hasActiveFilters}
			onClearFilters={clearFilters}
			{showMoreFilters}
			onToggleMoreFilters={() => (showMoreFilters = !showMoreFilters)}
			{hasActiveAdvancedFilters}
		>
			{#snippet filters()}
				{#if showGroupFilter}
					<LoanGroupFilter
						groups={groupScope.groupChips}
						selected={groupScope.groupSelection}
						showUngrouped={groupScope.showUngrouped}
						ungroupedCount={groupScope.ungroupedCount}
						onChange={groupScope.setGroupSelection}
					/>
				{/if}
			{/snippet}
			{#snippet toolbarTrailing()}
				{#if variant.showBulkActions && SHOW_GROUPS_UI && canManage && isMobileShell.matches}
					<Button
						type="button"
						variant={phoneSelectMode ? 'default' : 'outline'}
						size="sm"
						class="shrink-0 whitespace-nowrap"
						onclick={() => {
							phoneSelectMode = !phoneSelectMode;
							if (!phoneSelectMode) selectedRowIds = new Set();
						}}
					>
						{phoneSelectMode ? 'Done' : 'Select'}
					</Button>
				{/if}
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
				Showing {filteredLoans.length} of {scopedLoans.length} loans
			</p>
		{/if}

		{#if viewModeState.viewMode === 'table'}
			{#if variant.embedded && sortedLoans.length > 0}
				<CardPagination items={sortedLoans} itemsPerPage={10} itemName="loans" scrollToTop={false}>
					{#snippet children(pageLoans)}
						{@render loanTable(pageLoans, emptyMessage)}
					{/snippet}
				</CardPagination>
			{:else}
				{@render loanTable(
					sortedLoans,
					listLoans.length === 0 ? emptyMessage : 'No loans match your filters'
				)}
				{#if filteredLoans.length === 0 && hasActiveFilters && listLoans.length > 0}
					<div class="mt-4 flex justify-center">
						<Button variant="outline" onclick={clearFilters}>
							<X class="mr-2 h-4 w-4" />
							Clear filters
						</Button>
					</div>
				{/if}
			{/if}
		{:else if listLoans.length === 0}
			<ListEmptyState message={emptyMessage} icon={emptyIcon} />
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
			<CardPagination
				items={sortedLoans}
				itemsPerPage={9}
				itemName="loans"
				scrollToTop={!variant.embedded}
			>
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
								onAddCommission={rowActions.onAddCommission}
								onDelete={rowActions.onDelete}
								onRemoveFromGroup={rowActions.onRemoveFromGroup}
								onGroupFilter={(groupId) => groupScope.setGroupSelection(groupId)}
								hideGroupBadges={variant.hideGroupBadges}
								selectable={phoneSelectMode && variant.showBulkActions && SHOW_GROUPS_UI && canManage}
								selected={selectedRowIds.has(loan.id)}
								onSelectedChange={(checked) => {
									const next = new Set(selectedRowIds);
									if (checked) next.add(loan.id);
									else next.delete(loan.id);
									selectedRowIds = next;
								}}
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
			startCommissionEdit={detailStartCommissionEdit}
			onOpenChange={(open) => {
				isModalOpen = open;
				if (!open) {
					selectedLoan = null;
					detailStartInEdit = false;
					detailStartCommissionEdit = false;
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
			onSuccess={() => {
				const id = quickPaymentLoan?.id;
				if (id) void refreshLoans({ kind: 'upsert', loanId: id });
				else void refreshLoans();
			}}
		/>

		{#if contractDetailsLoan}
			<LoanContractDetailsModal
				loan={contractDetailsLoan}
				open={showContractDetailsModal}
				onOpenChange={handleContractDetailsOpenChange}
				onOpenChangeComplete={handleContractDetailsOpenChangeComplete}
				canEdit={canManage}
				onSaved={handleContractDetailsSaved}
			/>
		{/if}

		{#if variant.showBulkActions && SHOW_GROUPS_UI && canManage}
			<LoanBulkActionBar
				selectedCount={selectedLoans.length}
				selectedLoanIds={selectedLoans.map((l) => l.id)}
				groups={groupScope.groupsIndex.map((g) => ({
					id: g.id,
					name: g.name,
					color: g.color,
					loanCount: g.loanCount
				}))}
				currentGroupId={groupContext?.groupId ??
					(typeof groupScope.groupSelection === 'number' ? groupScope.groupSelection : null)}
				showAddToGroup={variant.showAddToGroup}
				onClear={() => (selectedRowIds = new Set())}
				onAdded={async () => {
					await refreshLoans();
				}}
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

		{#if groupContext}
			<ResponsiveModal
				open={loanPendingRemoval !== null}
				onOpenChange={(open) => {
					if (!open) {
						loanPendingRemoval = null;
						removePreview = null;
						removePreviewError = null;
					}
				}}
				title="Remove loan from group?"
				contentClass="sm:max-w-lg"
			>
				<div class="space-y-3">
					<p class="text-sm text-muted-foreground">
						People stay in the group unless they have no other loans here.
					</p>
					<AccessPreview
						preview={removePreview}
						loading={removePreviewLoading}
						error={removePreviewError}
					/>
				</div>
				{#snippet footer()}
					<Button
						type="button"
						variant="outline"
						class="touch-target h-12 w-full"
						disabled={isRemovingLoan}
						onclick={() => (loanPendingRemoval = null)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						class="touch-target h-12 w-full"
						disabled={isRemovingLoan || removePreviewLoading}
						onclick={() => void handleRemoveFromGroup()}
					>
						{isRemovingLoan ? 'Removing…' : 'Remove'}
					</Button>
				{/snippet}
			</ResponsiveModal>
		{/if}
{/snippet}

{#snippet loanTable(rows: LoanWithInvestors[], message: string)}
	<LoansTable
		loans={rows}
		emptyMessage={message}
		enableRowSelection={variant.showBulkActions && SHOW_GROUPS_UI && canManage}
		{selectedRowIds}
		onSelectedRowIdsChange={(ids) => (selectedRowIds = ids)}
		onQuickView={handleQuickView}
		onEdit={rowActions.onEdit}
		onAddPayment={rowActions.onAddPayment}
		onAddReceivedPayment={rowActions.onAddReceivedPayment}
		onDuplicate={rowActions.onDuplicate}
		onContractDetails={rowActions.onContractDetails}
		onAddCommission={rowActions.onAddCommission}
		onDelete={rowActions.onDelete}
		onRemoveFromGroup={rowActions.onRemoveFromGroup}
	/>
{/snippet}
