<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import {
		isMaturingFundedLoan,
		isOverdueLoanForDashboard
	} from '$lib/loan-due-date';
	import DetailHeader from '$lib/components/common/DetailHeader.svelte';
	import SummaryCard from '$lib/components/common/SummaryCard.svelte';
	import SearchFilter from '$lib/components/common/SearchFilter.svelte';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import RangeFilter from '$lib/components/common/RangeFilter.svelte';
	import MaturingLoansCard from '$lib/components/common/MaturingLoansCard.svelte';
	import PastDueLoansCard from '$lib/components/common/PastDueLoansCard.svelte';
	import CompletedLoansCard from '$lib/components/common/CompletedLoansCard.svelte';
	import PendingDisbursementsCard from '$lib/components/common/PendingDisbursementsCard.svelte';
	import LoansTable from '$lib/components/loans/LoansTable.svelte';
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
	import { isMobileShellViewport } from '$lib/composables/use-media-query.svelte';
	import { calculateAverageRate, calculateTotalInterest } from '$lib/calculations';
	import { calculateInvestorDebtStats, isFullyPaidDebt } from '$lib/debt-calculations';
	import { computeInvestorPortfolioCapitalStats } from '$lib/loan-list-summary';
	import { computeTotalLot, buildTotalLotMetric } from '$lib/lot-utils';
	import { INVESTOR_DETAIL_SUMMARY_GRID } from '$lib/summary-grid';
	import { formatCurrency } from '$lib/format';
	import { downloadLoansPdf } from '$lib/pdf-download';
	import { loanPDFSections } from '$lib/pdf-sections';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { Plus, X, Filter } from 'lucide-svelte';
	import { toast } from '$lib/toast';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';
	import type { PendingDisbursement } from '$lib/server/dashboard-data';
	import type {
		Borrower,
		DebtWithInvestor,
		Investor,
		InvestorWithLoans,
		LoanWithInvestors
	} from '$lib/types';

	interface Props {
		investor: InvestorWithLoans;
		loans: LoanWithInvestors[];
		onEdit?: () => void;
		canManage?: boolean;
	}

	let { investor, loans, onEdit, canManage = true }: Props = $props();

	const LOAN_TYPE_OPTIONS = [
		{ value: 'Lot Title', label: 'Lot Title' },
		{ value: 'OR/CR', label: 'OR/CR' },
		{ value: 'Agent', label: 'Agent' }
	];

	const LOAN_STATUS_OPTIONS = [
		{ value: 'Fully Funded', label: 'Fully Funded' },
		{ value: 'Partially Funded', label: 'Partially Funded' },
		{ value: 'Completed', label: 'Completed' },
		{ value: 'Overdue', label: 'Overdue' }
	];

	let pageTab = $state<'overview' | 'loans' | 'debts'>('overview');
	let overviewTypeFilter = $state<string[]>([]);
	let overviewStatusFilter = $state<string[]>([]);
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
	let createModalInvestors = $state<Investor[]>([]);
	let createModalBorrowers = $state<Borrower[]>([]);
	let createModalDuplicateData = $state<DuplicateLoanData | null>(null);
	let loadingCreateFormData = $state(false);
	const debtsViewMode = createResponsiveViewMode();

	/** Use `loans` graph (includes interestPeriods), not `investor.loanInvestors` from entity load. */
	const investorLoanInvestors = $derived(
		loans.flatMap((loan) =>
			(loan.loanInvestors ?? [])
				.filter((li) => li.investor?.id === investor.id)
				.map((li) => ({ ...li, loan }))
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
		const filteredLoanInvestors = investorLoanInvestors.filter((li) => {
			if (overviewTypeFilter.length && !overviewTypeFilter.includes(li.loan.type)) return false;
			if (overviewStatusFilter.length && !overviewStatusFilter.includes(li.loan.status)) {
				return false;
			}
			return true;
		});

		const capital = computeInvestorPortfolioCapitalStats(filteredLoanInvestors);
		const filteredLoanIds = new Set(filteredLoanInvestors.map((li) => li.loan.id));
		const filteredUniqueLoans = uniqueInvestorLoans.filter((loan) => filteredLoanIds.has(loan.id));
		const { totalLot, totalLotWithDepacto } = computeTotalLot(filteredUniqueLoans);
		const totalLoanInterest = capital.interestEstimate + capital.interestEarned;
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

	const filteredLoans = $derived(
		loans.filter((loan) => {
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

			const investorEntries = (loan.loanInvestors ?? []).filter(
				(li) => li.investor?.id === investor.id
			);
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
			for (const li of (loan.loanInvestors ?? []).filter(
				(entry) => !entry.isPaid && entry.investor?.id === investor.id
			)) {
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
		await invalidateAll();
	}

	async function loadCreateFormData() {
		if (createModalInvestors.length > 0 && createModalBorrowers.length > 0) return;
		loadingCreateFormData = true;
		try {
			const [investorRes, borrowerRes] = await Promise.all([
				fetch('/api/investors?simple=true'),
				fetch('/api/borrowers?simple=true')
			]);
			const investorData = await investorRes.json();
			const borrowerData = await borrowerRes.json();
			if (Array.isArray(investorData)) createModalInvestors = investorData;
			if (Array.isArray(borrowerData)) createModalBorrowers = borrowerData;
		} catch (error) {
			console.error('Failed to load loan form data', error);
			toast.error('Failed to load form data');
		} finally {
			loadingCreateFormData = false;
		}
	}

	async function openLoanCreate(duplicateData: DuplicateLoanData | null = null) {
		createModalDuplicateData = duplicateData;
		showLoanCreateModal = true;
		await loadCreateFormData();
	}

	function clearOverviewFilters() {
		overviewTypeFilter = [];
		overviewStatusFilter = [];
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
	}

	function clearDebtFilters() {
		debtSearchQuery = '';
		showPastDebts = false;
		debtIntervalFilter = [];
		minDebtAmount = '';
		maxDebtAmount = '';
	}

	const hasActiveOverviewFilters = $derived(
		overviewTypeFilter.length > 0 || overviewStatusFilter.length > 0
	);
	const hasActiveLoanFilters = $derived(
		loanSearchQuery !== '' ||
			loanTypeFilter.length > 0 ||
			loanStatusFilter.length > 0 ||
			freeLotFilter !== 'all' ||
			minPrincipal !== '' ||
			maxPrincipal !== '' ||
			minAvgRate !== '' ||
			maxAvgRate !== '' ||
			minInterest !== '' ||
			maxInterest !== '' ||
			minTotalAmount !== '' ||
			maxTotalAmount !== ''
	);
	const hasActiveDebtFilters = $derived(
		debtSearchQuery !== '' ||
			showPastDebts ||
			debtIntervalFilter.length > 0 ||
			minDebtAmount !== '' ||
			maxDebtAmount !== ''
	);
</script>

<div class="dashboard-stack">
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

	<Tabs.Root bind:value={pageTab} class="w-full">
		<Tabs.List class="grid w-full max-w-lg grid-cols-3">
			<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
			<Tabs.Trigger value="loans">Loans ({uniqueLoanCount})</Tabs.Trigger>
			<Tabs.Trigger value="debts">Borrowings ({investorDebts.length})</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="overview" class="mt-6 space-y-6">
			<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				<MultiSelectFilter
					options={LOAN_TYPE_OPTIONS}
					selected={overviewTypeFilter}
					onChange={(v) => (overviewTypeFilter = v)}
					placeholder="Type"
					allLabel="All Types"
					triggerClassName="w-full sm:w-[180px]"
				/>
				<MultiSelectFilter
					options={LOAN_STATUS_OPTIONS}
					selected={overviewStatusFilter}
					onChange={(v) => (overviewStatusFilter = v)}
					placeholder="Status"
					allLabel="All Status"
					triggerClassName="w-full sm:w-[180px]"
				/>
				{#if hasActiveOverviewFilters}
					<Button variant="outline" size="sm" onclick={clearOverviewFilters}>
						<X class="h-4 w-4 sm:mr-2" />
						<span class="hidden sm:inline">Clear Filters</span>
					</Button>
				{/if}
			</div>

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
					},
					{
						label: 'Upcoming Earnings',
						amount: overviewStats.interestEstimate,
						subValue: 'Open loans'
					},
					{
						label: 'Interest Earned',
						amount: overviewStats.interestEarned,
						subValue: 'Completed loans',
						valueClassName: 'text-chart-2'
					},
					{
						label: 'Total Loan Interest',
						amount: overviewStats.totalLoanInterest,
						subValue: 'Upcoming - Earned'
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

			<div class="grid items-start gap-2.5 md:grid-cols-2 2xl:grid-cols-4">
				<MaturingLoansCard loans={maturingLoans} />
				<PastDueLoansCard loans={overdueLoans} />
				<PendingDisbursementsCard disbursements={pendingDisbursements} />
				<CompletedLoansCard loans={completedLoans} />
			</div>
		</Tabs.Content>

		<Tabs.Content value="loans" class="mt-6 space-y-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				<SearchFilter
					value={loanSearchQuery}
					onChange={(v) => (loanSearchQuery = v)}
					placeholder="Search loans by name or notes..."
				/>
				<MultiSelectFilter
					options={LOAN_TYPE_OPTIONS}
					selected={loanTypeFilter}
					onChange={(v) => (loanTypeFilter = v)}
					placeholder="Select Type"
					allLabel="All Types"
					triggerClassName="hidden xl:flex w-full xl:w-[180px]"
				/>
				<MultiSelectFilter
					options={LOAN_STATUS_OPTIONS}
					selected={loanStatusFilter}
					onChange={(v) => (loanStatusFilter = v)}
					placeholder="Select Status"
					allLabel="All Status"
					triggerClassName="hidden xl:flex w-full xl:w-[180px]"
				/>
				<Button
					variant={showMoreLoanFilters ? 'secondary' : 'outline'}
					size="sm"
					onclick={() => (showMoreLoanFilters = !showMoreLoanFilters)}
				>
					<Filter class="h-4 w-4 xl:mr-2" />
					<span class="hidden xl:inline">{showMoreLoanFilters ? 'Less' : 'More'} Filters</span>
				</Button>
				{#if hasActiveLoanFilters}
					<Button variant="outline" size="sm" onclick={clearLoanFilters}>
						<X class="h-4 w-4 xl:mr-2" />
						<span class="hidden xl:inline">Clear All</span>
					</Button>
				{/if}
				<ExportButton
					data={loans}
					filteredData={filteredLoans}
					sections={loanPDFSections}
					onGeneratePDF={(data, keys) => downloadLoansPdf(data, keys, investor.id)}
				/>
				{#if canManage}
				<Button size="sm" onclick={() => openLoanCreate()}>
					<Plus class="h-3 w-3 xl:mr-1" />
					<span class="hidden xl:inline">Add Loan</span>
				</Button>
				{/if}
			</div>

			{#if showMoreLoanFilters}
				<div
					class="dashboard-filter-panel grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
				>
					<RangeFilter
						label="Total Principal"
						minValue={minPrincipal}
						maxValue={maxPrincipal}
						onMinChange={(v) => (minPrincipal = v)}
						onMaxChange={(v) => (maxPrincipal = v)}
						minPlaceholder="Min (₱)"
						maxPlaceholder="Max (₱)"
					/>
					<RangeFilter
						label="Avg. Rate"
						minValue={minAvgRate}
						maxValue={maxAvgRate}
						onMinChange={(v) => (minAvgRate = v)}
						onMaxChange={(v) => (maxAvgRate = v)}
						minPlaceholder="Min (%)"
						maxPlaceholder="Max (%)"
					/>
					<RangeFilter
						label="Total Interest"
						minValue={minInterest}
						maxValue={maxInterest}
						onMinChange={(v) => (minInterest = v)}
						onMaxChange={(v) => (maxInterest = v)}
						minPlaceholder="Min (₱)"
						maxPlaceholder="Max (₱)"
					/>
					<RangeFilter
						label="Total Amount"
						minValue={minTotalAmount}
						maxValue={maxTotalAmount}
						onMinChange={(v) => (minTotalAmount = v)}
						onMaxChange={(v) => (maxTotalAmount = v)}
						minPlaceholder="Min (₱)"
						maxPlaceholder="Max (₱)"
					/>
				</div>
			{/if}

			<LoansTable
				loans={filteredLoans}
				investorId={investor.id}
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
		</Tabs.Content>

		<Tabs.Content value="debts" class="mt-6 space-y-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				<SearchFilter
					value={debtSearchQuery}
					onChange={(v) => (debtSearchQuery = v)}
					placeholder="Search borrowings..."
				/>
				<Button
					variant={showMoreDebtFilters ? 'secondary' : 'outline'}
					size="sm"
					onclick={() => (showMoreDebtFilters = !showMoreDebtFilters)}
				>
					<Filter class="h-4 w-4 xl:mr-2" />
					<span class="hidden xl:inline">{showMoreDebtFilters ? 'Less' : 'More'} Filters</span>
				</Button>
				{#if hasActiveDebtFilters}
					<Button variant="outline" size="sm" onclick={clearDebtFilters}>
						<X class="h-4 w-4 xl:mr-2" />
						<span class="hidden xl:inline">Clear All</span>
					</Button>
				{/if}
				<ViewModeToggle
					viewMode={debtsViewMode.viewMode}
					onViewModeChange={debtsViewMode.setViewMode}
					hasData={filteredDebts.length > 0}
				/>
				{#if canManage}
				<Button size="sm" onclick={() => (showDebtModal = true)}>
					<Plus class="h-3 w-3 xl:mr-1" />
					<span class="hidden xl:inline">Add Borrowing</span>
				</Button>
				{/if}
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
	</Tabs.Root>

	<DebtCreateModal
		open={showDebtModal}
		onOpenChange={(open) => (showDebtModal = open)}
		preselectedInvestorId={investor.id}
		onSuccess={refresh}
	/>

	<LoanCreateModal
		open={showLoanCreateModal}
		onOpenChange={(open) => {
			showLoanCreateModal = open;
			if (!open) createModalDuplicateData = null;
		}}
		preselectedInvestorId={investor.id}
		investors={createModalInvestors}
		borrowers={createModalBorrowers}
		duplicateData={createModalDuplicateData}
		loadingFormData={loadingCreateFormData}
		onSuccess={refresh}
	/>

	<LoanDetailModal
		loan={selectedLoan}
		open={showLoanDetailModal}
		onOpenChange={(open) => {
			showLoanDetailModal = open;
			if (!open) selectedLoan = null;
		}}
		onUpdate={refresh}
		onDuplicate={(duplicateData) => {
			void openLoanCreate(duplicateData);
		}}
	/>
</div>
