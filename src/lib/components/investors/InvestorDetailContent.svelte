<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import {
		isMaturingFundedLoan,
		isOverdueLoanForDashboard
	} from '$lib/loan-due-date';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import SearchFilter from '$lib/components/common/SearchFilter.svelte';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import RangeFilter from '$lib/components/common/RangeFilter.svelte';
	import ListPageToolbar from '$lib/components/common/ListPageToolbar.svelte';
	import LoanListMoreFiltersPanel from '$lib/components/common/LoanListMoreFiltersPanel.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import DashboardActivityCards from '$lib/components/common/DashboardActivityCards.svelte';
	import LoansTable from '$lib/components/loans/LoansTable.svelte';
	import LoanListSummaryCards from '$lib/components/loans/LoanListSummaryCards.svelte';
	import LoanBulkActionBar from '$lib/components/loans/LoanBulkActionBar.svelte';
	import LoanSelectionSummaryModal from '$lib/components/loans/LoanSelectionSummaryModal.svelte';
	import DateRangeFilter from '$lib/components/common/DateRangeFilter.svelte';
	import LoanDetailModal from '$lib/components/loans/LoanDetailModal.svelte';
	import LoanCreateModal from '$lib/components/loans/LoanCreateModal.svelte';
	import DebtsTable from '$lib/components/debts/DebtsTable.svelte';
	import DebtCard from '$lib/components/debts/DebtCard.svelte';
	import DebtCreateModal from '$lib/components/debts/DebtCreateModal.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ViewModeToggle from '$lib/components/common/ViewModeToggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import { isMobileShellViewport, createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import { createLoanListDateRange } from '$lib/composables/use-loan-list-date-range.svelte';
	import { calculateAverageRate, calculateTotalInterest } from '$lib/calculations';
	import { calculateInvestorDebtStats, isFullyPaidDebt } from '$lib/debt-calculations';
	import {
		computeInvestorPortfolioCapitalStats,
		computeInvestorLoanListSummaryStats,
		computeLoanListSummaryStats,
		passesLoanDueDateRangeFilter
	} from '$lib/loan-list-summary';
	import { SHOW_GROUPS_UI } from '$lib/feature-flags';
	import type { GroupsIndexItem } from '$lib/groups/loan-group-filter';
	import { computeTotalLot, buildTotalLotMetric } from '$lib/lot-utils';
	import { INVESTOR_DETAIL_SUMMARY_GRID } from '$lib/summary-grid';
	import { formatCurrency } from '$lib/format';
	import { downloadLoansPdf } from '$lib/pdf-download';
	import { loanPDFSections } from '$lib/pdf-sections';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { createLoanFormOptions } from '$lib/composables/use-loan-form-options.svelte';
	import { Plus, X, Filter } from 'lucide-svelte';
	import { hasActiveLoanAmountFilters } from '$lib/loan-list-page-filters';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import type { PendingDisbursement } from '$lib/server/dashboard-data';
	import type {
		DebtWithInvestor,
		Investor,
		InvestorDetailEntity,
		LoanWithInvestors
	} from '$lib/types';

	interface Props {
		investor: InvestorDetailEntity;
		loans: LoanWithInvestors[];
		onEdit?: () => void;
		canManage?: boolean;
		/** Hide back/edit/delete chrome (group people, nested views). */
		embedded?: boolean;
		/** Borrowings tab and debt metrics. Off for group-scoped loan views. */
		showBorrowings?: boolean;
		/**
		 * When true, capital/filters/table use this investor's allocations.
		 * When false, they use every allocation on `loans` (owner/borrower/witness).
		 */
		scopeToInvestor?: boolean;
		/** When set with scopeToInvestor, match allocations by linked user. */
		investorUserId?: string | null;
	}

	let {
		investor,
		loans,
		onEdit,
		canManage = true,
		embedded = false,
		showBorrowings = true,
		scopeToInvestor = true,
		investorUserId = null
	}: Props = $props();

	let pageTab = $state<'overview' | 'loans' | 'debts'>('overview');
	let loanSearchQuery = $state('');
	let loanTypeFilter = $state<string[]>([]);
	let loanStatusFilter = $state<string[]>([]);
	let freeLotFilter = $state('all');
	let minPrincipal = $state('');
	let maxPrincipal = $state('');
	let minAvgRate = $state('');
	let maxAvgRate = $state('');
	let minInterest = $state('');
	let maxInterest = $state('');
	let minTotalAmount = $state('');
	let maxTotalAmount = $state('');
	let showMoreLoanFilters = $state(false);
	let debtSearchQuery = $state('');
	let showPastDebts = $state(false);
	let debtIntervalFilter = $state<string[]>([]);
	let minDebtAmount = $state('');
	let maxDebtAmount = $state('');
	let showMoreDebtFilters = $state(false);
	let showDebtModal = $state(false);
	let selectedLoan = $state<LoanWithInvestors | null>(null);
	let showLoanDetailModal = $state(false);
	let showLoanCreateModal = $state(false);
	let createModalDuplicateData = $state<DuplicateLoanData | null>(null);
	let selectedRowIds = $state(new Set<string | number>());
	let phoneSelectMode = $state(false);
	let summaryOpen = $state(false);
	const isMobileShell = createIsMobileShell(false);
	const debtsViewMode = createResponsiveViewMode();
	const loanFormOptions = createLoanFormOptions();

	const canBulkSelect = $derived(canManage && SHOW_GROUPS_UI);

	const dateRangeState = createLoanListDateRange(() => page, () => ({
		enabled: pageTab === 'loans',
		defaultPreset: 'month'
	}));
	const filterFrom = $derived(dateRangeState.filterFrom);
	const filterTo = $derived(dateRangeState.filterTo);

	const groupsIndex = $derived(
		((page.data as { groupsIndex?: GroupsIndexItem[] }).groupsIndex ?? []) as GroupsIndexItem[]
	);

	$effect(() => isMobileShell.init());

	$effect(() => {
		if (canManage) loanFormOptions.prefetch();
	});

	function allocationMatchesInvestor(allocation: {
		investor?: { id?: number; investorUserId?: string | null } | null;
	}): boolean {
		if (!scopeToInvestor) return true;
		if (investorUserId) {
			return allocation.investor?.investorUserId === investorUserId;
		}
		return allocation.investor?.id === investor.id;
	}

	function investorEntriesForLoan(loan: LoanWithInvestors) {
		const entries = loan.loanInvestors ?? [];
		if (!scopeToInvestor) return entries;
		return entries.filter((entry) => allocationMatchesInvestor(entry));
	}

	/** Use `loans` graph (includes interestPeriods), not `investor.loanInvestors` from entity load. */
	const investorLoanInvestors = $derived(
		loans.flatMap((loan) =>
			investorEntriesForLoan(loan).map((li) => ({ ...li, loan }))
		)
	);
	const uniqueLoanCount = $derived(loans.length);
	const investorDebts = $derived(investor.debts ?? []);
	const investorTransactions = $derived(investor.transactions ?? []);
	const debtStats = $derived(calculateInvestorDebtStats(investorDebts));

	const investorProfile: Investor = $derived({
		id: investor.id,
		name: investor.name,
		email: investor.email,
		contactNumber: investor.contactNumber,
		address: investor.address,
		validIdUrl: investor.validIdUrl,
		eSignatureUrl: investor.eSignatureUrl,
		createdAt: investor.createdAt,
		updatedAt: investor.updatedAt
	});

	const uniqueInvestorLoans = $derived(loans);

	const overviewStats = $derived.by(() => {
		const capital = computeInvestorPortfolioCapitalStats(investorLoanInvestors);
		const filteredLoanIds = new Set(investorLoanInvestors.map((li) => li.loan.id));
		const filteredUniqueLoans = uniqueInvestorLoans.filter((loan) => filteredLoanIds.has(loan.id));
		const { totalLot, totalLotWithDepacto } = computeTotalLot(filteredUniqueLoans);
		const totalLoanInterest = capital.totalInterestScheduled;
		const netEarnings = totalLoanInterest - debtStats.interestPaid;

		return {
			...capital,
			totalLoanInterest,
			netEarnings,
			totalLot,
			totalLotWithDepacto
		};
	});

	const debtsWithInvestor: DebtWithInvestor[] = $derived(
		investorDebts.map((debt) => ({
			...debt,
			additionalFees: debt.additionalFees ?? [],
			investor: investorProfile
		}))
	);

	const filteredDebts = $derived(
		debtsWithInvestor.filter((debt) => {
			if (debtSearchQuery) {
				const q = debtSearchQuery.toLowerCase();
				if (
					!debt.name.toLowerCase().includes(q) &&
					!(debt.notes?.toLowerCase().includes(q) ?? false)
				) {
					return false;
				}
			}
			if (!showPastDebts && isFullyPaidDebt(debt)) return false;
			if (debtIntervalFilter.length && !debtIntervalFilter.includes(debt.interestInterval)) {
				return false;
			}
			const amount = parseFloat(debt.amount);
			if (minDebtAmount !== '' && amount < parseFloat(minDebtAmount)) return false;
			if (maxDebtAmount !== '' && amount > parseFloat(maxDebtAmount)) return false;
			return true;
		})
	);

	const dateFilteredLoans = $derived(
		loans.filter((loan) => passesLoanDueDateRangeFilter(loan, filterFrom, filterTo))
	);

	const filteredLoans = $derived(
		dateFilteredLoans.filter((loan) => {
			if (loanSearchQuery) {
				const q = loanSearchQuery.toLowerCase();
				if (
					!loan.loanName.toLowerCase().includes(q) &&
					!(loan.notes?.toLowerCase().includes(q) ?? false)
				) {
					return false;
				}
			}
			if (loanTypeFilter.length && !loanTypeFilter.includes(loan.type)) return false;
			if (loanStatusFilter.length && !loanStatusFilter.includes(loan.status)) return false;
			if (freeLotFilter === 'with' && !loan.freeLotSqm) return false;
			if (freeLotFilter === 'without' && loan.freeLotSqm) return false;

			const investorEntries = investorEntriesForLoan(loan);
			const totalPrincipal = investorEntries.reduce((sum, li) => sum + parseFloat(li.amount), 0);
			const totalInterest = calculateTotalInterest(investorEntries);
			const avgRate = calculateAverageRate(investorEntries);
			const totalAmount = totalPrincipal + totalInterest;

			if (minPrincipal !== '' && totalPrincipal < parseFloat(minPrincipal)) return false;
			if (maxPrincipal !== '' && totalPrincipal > parseFloat(maxPrincipal)) return false;
			if (minAvgRate !== '' && avgRate < parseFloat(minAvgRate)) return false;
			if (maxAvgRate !== '' && avgRate > parseFloat(maxAvgRate)) return false;
			if (minInterest !== '' && totalInterest < parseFloat(minInterest)) return false;
			if (maxInterest !== '' && totalInterest > parseFloat(maxInterest)) return false;
			if (minTotalAmount !== '' && totalAmount < parseFloat(minTotalAmount)) return false;
			if (maxTotalAmount !== '' && totalAmount > parseFloat(maxTotalAmount)) return false;
			return true;
		})
	);

	const dateFilteredAllocations = $derived(
		dateFilteredLoans.flatMap((loan) =>
			investorEntriesForLoan(loan).map((li) => ({ ...li, loan }))
		)
	);

	const allInvestorAllocations = $derived(
		loans.flatMap((loan) => investorEntriesForLoan(loan).map((li) => ({ ...li, loan })))
	);

	const sortedFilteredLoans = $derived(
		[...filteredLoans].sort(
			(a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
		)
	);

	const selectedLoans = $derived(
		sortedFilteredLoans.filter((loan) => selectedRowIds.has(loan.id))
	);

	const selectedInvestorAllocations = $derived(
		selectedLoans.flatMap((loan) =>
			investorEntriesForLoan(loan).map((li) => ({ ...li, loan }))
		)
	);

	const loansTabSummaryStats = $derived.by(() => {
		if (dateFilteredLoans.length === 0) return null;
		if (scopeToInvestor) {
			return computeInvestorLoanListSummaryStats(
				dateFilteredAllocations,
				filterFrom,
				filterTo,
				allInvestorAllocations
			);
		}
		return computeLoanListSummaryStats(
			dateFilteredLoans,
			filterFrom,
			filterTo,
			loans
		);
	});

	$effect(() => {
		if (selectedLoans.length === 0) summaryOpen = false;
	});

	const overdueLoans = $derived(
		loans
			.filter((loan) => isOverdueLoanForDashboard(loan))
			.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
	);

	const completedLoans = $derived(
		loans
			.filter((loan) => loan.status === 'Completed')
			.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
	);

	const maturingLoans = $derived(
		loans
			.filter((loan) => isMaturingFundedLoan(loan))
			.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
	);

	const pendingDisbursements = $derived.by(() => {
		const items: PendingDisbursement[] = [];
		for (const loan of loans) {
			for (const li of investorEntriesForLoan(loan).filter((entry) => !entry.isPaid)) {
				items.push({
					id: li.id,
					loanId: loan.id,
					loanName: loan.loanName,
					loanType: loan.type,
					investorName: li.investor.name,
					amount: li.amount,
					sentDate: li.sentDate
				});
			}
		}
		return items.sort((a, b) => new Date(a.sentDate).getTime() - new Date(b.sentDate).getTime());
	});

	const canDelete = $derived(
		canManage &&
			investorLoanInvestors.length === 0 &&
			investorTransactions.length === 0 &&
			investorDebts.length === 0
	);

	async function handleDelete() {
		const response = await fetch(`/api/investors/${investor.id}`, { method: 'DELETE' });
		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || 'Failed to delete investor');
		}
		await goto('/investors');
	}

	async function refresh() {
		await invalidate('app:investors');
	}

	function openLoanCreate(duplicateData: DuplicateLoanData | null = null) {
		createModalDuplicateData = duplicateData;
		showLoanCreateModal = true;
		void loanFormOptions.load();
	}

	function clearLoanFilters() {
		loanSearchQuery = '';
		loanTypeFilter = [];
		loanStatusFilter = [];
		freeLotFilter = 'all';
		minPrincipal = '';
		maxPrincipal = '';
		minAvgRate = '';
		maxAvgRate = '';
		minInterest = '';
		maxInterest = '';
		minTotalAmount = '';
		maxTotalAmount = '';
		if (pageTab === 'loans') {
			dateRangeState.clearDateFilter();
		}
	}

	function clearDebtFilters() {
		debtSearchQuery = '';
		showPastDebts = false;
		debtIntervalFilter = [];
		minDebtAmount = '';
		maxDebtAmount = '';
	}

	const hasActiveAdvancedLoanFilters = $derived(
		loanTypeFilter.length > 0 ||
			loanStatusFilter.length > 0 ||
			freeLotFilter !== 'all' ||
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

	const hasActiveLoanFilters = $derived(
		loanSearchQuery !== '' ||
			hasActiveAdvancedLoanFilters ||
			(pageTab === 'loans' && dateRangeState.isDateFilterActive)
	);
	const hasActiveDebtFilters = $derived(
		debtSearchQuery !== '' ||
			showPastDebts ||
			debtIntervalFilter.length > 0 ||
			minDebtAmount !== '' ||
			maxDebtAmount !== ''
	);
</script>

<div class={embedded ? 'space-y-4' : 'dashboard-stack'}>
	{#if !embedded}
		<DetailHeader
			title={investor.name}
			description="Investor portfolio and activity"
			backLabel="Back to Investors"
			onBack={() => goto('/investors')}
			onEdit={canManage ? onEdit : undefined}
			canEdit={canManage}
			onDelete={handleDelete}
			deleteTitle="Delete Investor"
			deleteDescription={`Are you sure you want to delete ${investor.name}? This action cannot be undone.`}
			{canDelete}
			deleteWarning={`Cannot delete this investor because they have ${investorLoanInvestors.length} active loan(s) and ${investorDebts.length} borrowing(s). Remove those first.`}
		/>
	{/if}

	<Tabs.Root bind:value={pageTab} class="w-full">
		<Tabs.List
			class={cn('grid w-full max-w-lg', showBorrowings ? 'grid-cols-3' : 'grid-cols-2')}
		>
			<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
			<Tabs.Trigger value="loans">Loans ({uniqueLoanCount})</Tabs.Trigger>
			{#if showBorrowings}
				<Tabs.Trigger value="debts">Borrowings ({investorDebts.length})</Tabs.Trigger>
			{/if}
		</Tabs.List>

		<Tabs.Content value="overview" class="mt-6 space-y-6">
			<SummaryCard
				class={INVESTOR_DETAIL_SUMMARY_GRID}
				metrics={[
					{
						label: 'Total Capital',
						amount: overviewStats.totalCapital,
						subCount: overviewStats.totalLoanCount,
						subCountSuffix: ' loans'
					},
					{
						label: 'Active',
						amount: overviewStats.activeCapital,
						subCount: overviewStats.activeLoansCount,
						subCountSuffix: ' loans'
					},
					...(showBorrowings
						? [
								{
									label: 'Active Borrowings',
									amount: debtStats.activePrincipal,
									subCount: debtStats.activeCount,
									subCountSuffix: ' borrowings',
									empty: debtStats.totalCount === 0
								},
								{
									label: 'Borrowing Cost Paid',
									amount: debtStats.interestPaid,
									subValue: 'Interest and fees paid',
									empty: debtStats.totalCount === 0
								}
							]
						: []),
					{
						label: 'Interest Estimate',
						amount: overviewStats.interestEstimate
					},
					{
						label: 'Interest Earned',
						amount: overviewStats.interestEarned,
						subValue: 'Completed loans',
						valueClassName: 'text-chart-2'
					},
					{
						label: 'Net Earnings',
						amount: overviewStats.netEarnings,
						subValue:
							debtStats.totalCount > 0
								? 'Loan interest - Borrowing cost'
								: 'Loan interest scheduled',
						valueClassName: overviewStats.netEarnings >= 0 ? undefined : 'text-chart-3'
					},
					buildTotalLotMetric(overviewStats.totalLot, overviewStats.totalLotWithDepacto)
				]}
			/>

			<DashboardActivityCards
				completedLoans={completedLoans}
				overdueLoans={overdueLoans}
				pendingDisbursements={pendingDisbursements}
				upcomingPaymentsDue={maturingLoans}
			/>
		</Tabs.Content>

		<Tabs.Content value="loans" class="mt-6 space-y-4">
			<ListPageToolbar
				searchValue={loanSearchQuery}
				searchPlaceholder="Search loans by name or notes..."
				onSearchChange={(v) => (loanSearchQuery = v)}
				hasActiveFilters={hasActiveLoanFilters}
				onClearFilters={clearLoanFilters}
				showMoreFilters={showMoreLoanFilters}
				onToggleMoreFilters={() => (showMoreLoanFilters = !showMoreLoanFilters)}
				hasActiveAdvancedFilters={hasActiveAdvancedLoanFilters}
				selectMode={phoneSelectMode && isMobileShell.matches}
			>
				{#snippet afterSearch()}
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
				{/snippet}
				{#snippet toolbarTrailing()}
					{#if canBulkSelect && isMobileShell.matches}
						<Button
							type="button"
							variant={phoneSelectMode ? 'default' : 'outline'}
							size="sm"
							class="shrink-0 whitespace-nowrap"
							onclick={() => {
								phoneSelectMode = !phoneSelectMode;
								if (!phoneSelectMode) selectedRowIds = new Set();
								else showMoreLoanFilters = false;
							}}
						>
							{phoneSelectMode ? 'Done' : 'Select'}
						</Button>
					{/if}
					{#if !(phoneSelectMode && isMobileShell.matches)}
						<ExportButton
							data={loans}
							filteredData={sortedFilteredLoans}
							selectedData={selectedLoans}
							sections={loanPDFSections}
							onGeneratePDF={(data, keys) =>
								downloadLoansPdf(data, keys, scopeToInvestor ? investor.id : undefined)}
						/>
						{#if canManage}
							<Button size="sm" class="shrink-0" onclick={() => openLoanCreate()}>
								<Plus class="h-3 w-3 xl:mr-1" />
								<span class="hidden xl:inline">Add Loan</span>
							</Button>
						{/if}
					{/if}
				{/snippet}
				{#snippet moreFilters()}
					<LoanListMoreFiltersPanel
						statusFilter={loanStatusFilter}
						typeFilter={loanTypeFilter}
						onStatusChange={(v) => (loanStatusFilter = v)}
						onTypeChange={(v) => (loanTypeFilter = v)}
						{minPrincipal}
						{maxPrincipal}
						onMinPrincipalChange={(v) => (minPrincipal = v)}
						onMaxPrincipalChange={(v) => (maxPrincipal = v)}
						{minAvgRate}
						{maxAvgRate}
						onMinAvgRateChange={(v) => (minAvgRate = v)}
						onMaxAvgRateChange={(v) => (maxAvgRate = v)}
						{minInterest}
						{maxInterest}
						onMinInterestChange={(v) => (minInterest = v)}
						onMaxInterestChange={(v) => (maxInterest = v)}
						{minTotalAmount}
						{maxTotalAmount}
						onMinTotalAmountChange={(v) => (minTotalAmount = v)}
						onMaxTotalAmountChange={(v) => (maxTotalAmount = v)}
					/>
				{/snippet}
			</ListPageToolbar>

			{#if loansTabSummaryStats}
				<LoanListSummaryCards stats={loansTabSummaryStats} />
			{/if}

			<LoansTable
				loans={sortedFilteredLoans}
				enableRowSelection={canBulkSelect}
				selectedRowIds={selectedRowIds}
				onSelectedRowIdsChange={(ids) => (selectedRowIds = ids)}
				investorId={scopeToInvestor && !investorUserId ? investor.id : undefined}
				investorUserId={scopeToInvestor ? investorUserId : undefined}
				emptyMessage={uniqueLoanCount === 0
					? 'No loans yet.'
					: 'No loans match your filters.'}
				onQuickView={(loan) => {
						if (isMobileShellViewport()) {
							goto(`/loans/${loan.id}`);
							return;
						}
						selectedLoan = loan;
						showLoanDetailModal = true;
					}}
				/>
			{#if filteredLoans.length === 0 && uniqueLoanCount > 0}
				<div class="mt-4 flex justify-center">
					<Button variant="outline" onclick={clearLoanFilters}>
						<X class="mr-2 h-4 w-4" />
						Clear filters
					</Button>
				</div>
			{/if}

			{#if canBulkSelect}
				<LoanBulkActionBar
					selectedCount={selectedLoans.length}
					selectedLoanIds={selectedLoans.map((l) => l.id)}
					groups={groupsIndex.map((g) => ({
						id: g.id,
						name: g.name,
						color: g.color,
						loanCount: g.loanCount
					}))}
					showAddToGroup={canManage}
					onSummary={() => (summaryOpen = true)}
					onClear={() => (selectedRowIds = new Set())}
					onAdded={refresh}
				/>
			{/if}

			<LoanSelectionSummaryModal
				open={summaryOpen}
				onOpenChange={(open) => (summaryOpen = open)}
				loans={selectedLoans}
				from={filterFrom}
				to={filterTo}
				investorAllocations={scopeToInvestor ? selectedInvestorAllocations : null}
			/>
		</Tabs.Content>

		{#if showBorrowings}
		<Tabs.Content value="debts" class="mt-6 space-y-4">
			<div class="mobile-list-toolbar">
				<SearchFilter
					value={debtSearchQuery}
					onChange={(v) => (debtSearchQuery = v)}
					placeholder="Search borrowings..."
					class="min-w-0 flex-1 lg:min-w-[12rem]"
				/>
				<div class="mobile-list-toolbar-controls">
					<Button
						variant={showMoreDebtFilters ? 'secondary' : 'outline'}
						size="sm"
						class="shrink-0"
						onclick={() => (showMoreDebtFilters = !showMoreDebtFilters)}
					>
						<Filter class="h-4 w-4 xl:mr-2" />
						<span class="hidden xl:inline">{showMoreDebtFilters ? 'Less' : 'More'} Filters</span>
					</Button>
					{#if hasActiveDebtFilters}
						<Button variant="outline" size="sm" class="shrink-0" onclick={clearDebtFilters}>
							<X class="h-4 w-4 xl:mr-2" />
							<span class="hidden xl:inline">Clear All</span>
						</Button>
					{/if}
					<ViewModeToggle
						viewMode={debtsViewMode.viewMode}
						onViewModeChange={debtsViewMode.setViewMode}
						hasData={filteredDebts.length > 0}
						class="shrink-0"
					/>
					{#if canManage}
						<Button size="sm" class="shrink-0" onclick={() => (showDebtModal = true)}>
							<Plus class="h-3 w-3 xl:mr-1" />
							<span class="hidden xl:inline">Add Borrowing</span>
						</Button>
					{/if}
				</div>
			</div>

			{#if showMoreDebtFilters}
				<div class="dashboard-filter-panel">
					<RangeFilter
						label="Principal Amount"
						minValue={minDebtAmount}
						maxValue={maxDebtAmount}
						onMinChange={(v) => (minDebtAmount = v)}
						onMaxChange={(v) => (maxDebtAmount = v)}
						minPlaceholder="Min (₱)"
						maxPlaceholder="Max (₱)"
					/>
				</div>
			{/if}

			{#if debtsViewMode.viewMode === 'table'}
				<DebtsTable
					debts={filteredDebts}
					itemsPerPage={10}
					emptyMessage={investorDebts.length === 0
						? 'No borrowings yet.'
						: 'No borrowings match your filters.'}
					onQuickView={(debt) => goto(`/debts/${debt.id}`)}
				/>
				{#if investorDebts.length === 0}
					{#if canManage}
					<div class="mt-4 flex justify-center">
						<Button size="sm" onclick={() => (showDebtModal = true)}>
							<Plus class="mr-2 h-4 w-4" />
							Add Borrowing
						</Button>
					</div>
					{/if}
				{:else if filteredDebts.length === 0}
					<div class="mt-4 flex justify-center">
						<Button variant="outline" onclick={clearDebtFilters}>
							<X class="mr-2 h-4 w-4" />
							Clear filters
						</Button>
					</div>
				{/if}
			{:else if investorDebts.length === 0}
				<Card.Root>
					<Card.Content class="dashboard-empty gap-3">
						<p class="text-muted-foreground">No borrowings yet</p>
						{#if canManage}
						<Button size="sm" onclick={() => (showDebtModal = true)}>
							<Plus class="mr-2 h-4 w-4" />
							Add Borrowing
						</Button>
						{/if}
					</Card.Content>
				</Card.Root>
			{:else if filteredDebts.length === 0}
				<Card.Root>
					<Card.Content class="dashboard-empty">
						<p class="mb-4 text-muted-foreground">No borrowings match your filters</p>
						<Button variant="outline" onclick={clearDebtFilters}>
							<X class="mr-2 h-4 w-4" />
							Clear filters
						</Button>
					</Card.Content>
				</Card.Root>
			{:else}
				<CardPagination
					items={filteredDebts}
					itemsPerPage={10}
					itemName="borrowings"
					scrollToTop={false}
				>
					{#snippet children(paginatedDebts)}
						<div class="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-2 2xl:grid-cols-3">
							{#each paginatedDebts as debt (debt.id)}
								<DebtCard {debt} viewHref="/debts/{debt.id}" />
							{/each}
						</div>
					{/snippet}
				</CardPagination>
			{/if}
		</Tabs.Content>
		{/if}
	</Tabs.Root>

	{#if showBorrowings && canManage}
	<DebtCreateModal
		open={showDebtModal}
		onOpenChange={(open) => (showDebtModal = open)}
		preselectedInvestorId={investor.id}
		onSuccess={refresh}
	/>
	{/if}

	{#if canManage}
	<LoanCreateModal
		open={showLoanCreateModal}
		onOpenChange={(open) => {
			showLoanCreateModal = open;
			if (!open) createModalDuplicateData = null;
		}}
		preselectedInvestorId={investor.id}
		investors={loanFormOptions.investors}
		borrowers={loanFormOptions.borrowers}
		duplicateData={createModalDuplicateData}
		loadingFormData={loanFormOptions.loading}
		onSuccess={refresh}
	/>
	{/if}

	<LoanDetailModal
		loan={selectedLoan}
		open={showLoanDetailModal}
		onOpenChange={(open) => {
			showLoanDetailModal = open;
			if (!open) selectedLoan = null;
		}}
		onUpdate={refresh}
		onDuplicate={canManage ? (duplicateData) => {
			openLoanCreate(duplicateData);
		} : undefined}
	/>
</div>
