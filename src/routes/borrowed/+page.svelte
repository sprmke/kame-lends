<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SearchFilter from '$lib/components/common/SearchFilter.svelte';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import SyncCalendarButton from '$lib/components/common/SyncCalendarButton.svelte';
	import ViewModeToggle from '$lib/components/common/ViewModeToggle.svelte';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import RangeFilter from '$lib/components/common/RangeFilter.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import LoansTable from '$lib/components/loans/LoansTable.svelte';
	import LoanCalendarView from '$lib/components/loans/LoanCalendarView.svelte';
	import LoanDetailModal from '$lib/components/loans/LoanDetailModal.svelte';
	import LoanCreateModal from '$lib/components/loans/LoanCreateModal.svelte';
	import LoanQuickPaymentDialog, {
		type LoanQuickPaymentKind
	} from '$lib/components/loans/LoanQuickPaymentDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { formatCurrency, formatDateVeryShort, formatText, formatPercentage } from '$lib/format';
	import { calculateTransactionStats, calculateLoanStats } from '$lib/calculations';
	import { downloadLoansPdf } from '$lib/pdf-download';
	import { loanPDFSections } from '$lib/pdf-sections';
	import { getLoanStatusBadge, getLoanTypeBadge } from '$lib/badge-config';
	import { createDuplicateDataFromLoan } from '$lib/loan-duplicate';
	import { downloadLoanContract } from '$lib/download-loan-contract';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils';
	import { PlusCircle, X, Filter } from 'lucide-svelte';
	import type { Borrower, Investor, LoanWithInvestors } from '$lib/types';
	import type { DuplicateLoanData } from '$lib/loan-duplicate';

	let { data } = $props();
	const pageTitle = $derived((data as { pageTitle?: string }).pageTitle ?? 'Borrowed');
	const canCreate = $derived((data as { canCreate?: boolean }).canCreate !== false);
	const canManage = $derived((data as { canManage?: boolean }).canManage !== false);

	let loans = $state<LoanWithInvestors[] | null>(null);

	$effect(() => {
		let active = true;
		data.loans.then((value) => {
			if (active) loans = value as LoanWithInvestors[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
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
	let downloadingContractLoanId = $state<number | null>(null);
	let showCreateModal = $state(false);
	let createModalInvestors = $state<Investor[]>([]);
	let createModalBorrowers = $state<Borrower[]>([]);
	let createModalDuplicateData = $state<DuplicateLoanData | null>(null);
	let loadingCreateFormData = $state(false);

	onMount(() => viewModeState.init());

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

	async function openCreateModal(duplicateData: DuplicateLoanData | null = null) {
		createModalDuplicateData = duplicateData;
		showCreateModal = true;
		await loadCreateFormData();
	}

	function closeCreateModal() {
		showCreateModal = false;
		createModalDuplicateData = null;
	}

	async function refreshLoans() {
		await invalidate('app:loans');
		loans = (await data.loans) as LoanWithInvestors[];
	}

	async function fetchFullLoan(loan: LoanWithInvestors): Promise<LoanWithInvestors> {
		try {
			const response = await fetch(`/api/loans/${loan.id}`);
			if (response.ok) return (await response.json()) as LoanWithInvestors;
		} catch {
			// Fall back to list row data.
		}
		return loan;
	}

	function handleQuickView(loan: LoanWithInvestors) {
		selectedLoan = loan;
		isModalOpen = true;
	}

	function handleRowEdit(loan: LoanWithInvestors) {
		goto(`/loans/${loan.id}`);
	}

	async function handleRowDuplicate(loan: LoanWithInvestors) {
		const sourceLoan = await fetchFullLoan(loan);
		const duplicateData = createDuplicateDataFromLoan(sourceLoan);
		await openCreateModal(duplicateData);
	}

	async function handleQuickPayment(loan: LoanWithInvestors, kind: LoanQuickPaymentKind) {
		quickPaymentLoan = await fetchFullLoan(loan);
		quickPaymentKind = kind;
	}

	async function handleRowDownloadContract(loan: LoanWithInvestors) {
		downloadingContractLoanId = loan.id;
		try {
			const sourceLoan = await fetchFullLoan(loan);
			await downloadLoanContract(sourceLoan);
		} finally {
			downloadingContractLoanId = null;
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

			const stats = calculateLoanStats(loan);

			if (minPrincipal !== '' && stats.totalPrincipal < parseFloat(minPrincipal)) return false;
			if (maxPrincipal !== '' && stats.totalPrincipal > parseFloat(maxPrincipal)) return false;
			if (minAvgRate !== '' && stats.avgRate < parseFloat(minAvgRate)) return false;
			if (maxAvgRate !== '' && stats.avgRate > parseFloat(maxAvgRate)) return false;
			if (minInterest !== '' && stats.totalInterest < parseFloat(minInterest)) return false;
			if (maxInterest !== '' && stats.totalInterest > parseFloat(maxInterest)) return false;
			if (minTotalAmount !== '' && stats.totalAmount < parseFloat(minTotalAmount)) return false;
			if (maxTotalAmount !== '' && stats.totalAmount > parseFloat(maxTotalAmount)) return false;

			return true;
		})
	);

	const sortedLoans = $derived(
		[...filteredLoans].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
	);

	const selectedLoans = $derived(sortedLoans.filter((loan) => selectedRowIds.has(loan.id)));

	const hasActiveAmountFilters = $derived(
		minPrincipal !== '' ||
			maxPrincipal !== '' ||
			minAvgRate !== '' ||
			maxAvgRate !== '' ||
			minInterest !== '' ||
			maxInterest !== '' ||
			minTotalAmount !== '' ||
			maxTotalAmount !== ''
	);

	const hasActiveFilters = $derived(
		searchQuery !== '' ||
			statusFilter.length > 0 ||
			typeFilter.length > 0 ||
			!!dueDateFilter ||
			hasActiveAmountFilters
	);

	function clearFilters() {
		searchQuery = '';
		statusFilter = [];
		typeFilter = [];
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
		<PageHeader title={pageTitle} description="" showPriceToggle={true}>
			<ViewModeToggle
				viewMode={viewModeState.viewMode}
				onViewModeChange={viewModeState.setViewMode}
				showCalendar={true}
				hasData={loans.length > 0}
			/>
			<ExportButton
				data={loans}
				filteredData={sortedLoans}
				selectedData={selectedLoans}
				sections={loanPDFSections}
				onGeneratePDF={downloadLoansPdf}
			/>
			{#if canCreate}
				<SyncCalendarButton variant="outline" size="default" />
				<Button class="h-9 px-3" onclick={() => openCreateModal()}>
					<PlusCircle class="h-4 w-4 xl:mr-2" />
					<span class="hidden xl:inline">New Loan</span>
				</Button>
			{/if}
		</PageHeader>

		<div class="flex flex-col gap-2 sm:flex-row">
			<SearchFilter
				value={searchQuery}
				onChange={(v) => (searchQuery = v)}
				placeholder="Search loans by name or notes..."
			/>
			<MultiSelectFilter
				options={[
					{ value: 'Fully Funded', label: 'Fully Funded' },
					{ value: 'Partially Funded', label: 'Partially Funded' },
					{ value: 'Completed', label: 'Completed' },
					{ value: 'Overdue', label: 'Overdue' }
				]}
				selected={statusFilter}
				onChange={(v) => (statusFilter = v)}
				placeholder="Select Status"
				allLabel="All Status"
				triggerClassName="hidden h-9 w-full xl:flex xl:w-[180px]"
			/>
			<MultiSelectFilter
				options={[
					{ value: 'Lot Title', label: 'Lot Title' },
					{ value: 'OR/CR', label: 'OR/CR' },
					{ value: 'Agent', label: 'Agent' }
				]}
				selected={typeFilter}
				onChange={(v) => (typeFilter = v)}
				placeholder="Select Type"
				allLabel="All Types"
				triggerClassName="hidden h-9 w-full xl:flex xl:w-[180px]"
			/>
			<Button
				variant={showMoreFilters ? 'secondary' : 'outline'}
				size="sm"
				class="relative h-9 px-3 whitespace-nowrap"
				onclick={() => (showMoreFilters = !showMoreFilters)}
			>
				<Filter class="h-4 w-4 xl:mr-2" />
				<span class="hidden xl:inline">{showMoreFilters ? 'Less' : 'More'} Filters</span>
				{#if hasActiveAmountFilters}
					<span class="relative ml-1 flex h-2 w-2 xl:ml-2">
						<span
							class="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-primary opacity-75"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
					</span>
				{/if}
			</Button>
			{#if hasActiveFilters}
				<Button variant="outline" size="sm" class="h-9" onclick={clearFilters}>
					<X class="h-4 w-4 xl:mr-2" />
					<span class="hidden xl:inline">Clear All</span>
				</Button>
			{/if}
		</div>

		{#if showMoreFilters}
			<div class="dashboard-filter-panel animate-in duration-200 slide-in-from-top-2">
				<div class="grid grid-cols-2 gap-3 border-b pb-3 xl:hidden">
					<div>
						<p class="mb-2 block text-xs font-semibold">Status</p>
						<MultiSelectFilter
							options={[
								{ value: 'Fully Funded', label: 'Fully Funded' },
								{ value: 'Partially Funded', label: 'Partially Funded' },
								{ value: 'Completed', label: 'Completed' },
								{ value: 'Overdue', label: 'Overdue' }
							]}
							selected={statusFilter}
							onChange={(v) => (statusFilter = v)}
							placeholder="Select Status"
							allLabel="All Status"
							triggerClassName="h-9 w-full"
						/>
					</div>
					<div>
						<p class="mb-2 block text-xs font-semibold">Type</p>
						<MultiSelectFilter
							options={[
								{ value: 'Lot Title', label: 'Lot Title' },
								{ value: 'OR/CR', label: 'OR/CR' },
								{ value: 'Agent', label: 'Agent' }
							]}
							selected={typeFilter}
							onChange={(v) => (typeFilter = v)}
							placeholder="Select Type"
							allLabel="All Types"
							triggerClassName="h-9 w-full"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
			</div>
		{/if}

		{#if hasActiveFilters}
			<p class="text-sm text-muted-foreground">
				Showing {filteredLoans.length} of {loans.length} loans
			</p>
		{/if}

		{#if loans.length === 0}
			<Card.Root>
				<Card.Content class="dashboard-empty">
					<p class="mb-4 text-muted-foreground">No loans found</p>
					<Button href="/loans/new">
						<PlusCircle class="mr-2 h-4 w-4" />
						Create your first loan
					</Button>
				</Card.Content>
			</Card.Root>
		{:else if filteredLoans.length === 0}
			<Card.Root>
				<Card.Content class="dashboard-empty">
					<p class="mb-4 text-muted-foreground">No loans match your filters</p>
					<Button variant="outline" onclick={clearFilters}>
						<X class="mr-2 h-4 w-4" />
						Clear filters
					</Button>
				</Card.Content>
			</Card.Root>
		{:else if viewModeState.viewMode === 'table'}
			<LoansTable
				loans={sortedLoans}
				enableRowSelection={true}
				{selectedRowIds}
				onSelectedRowIdsChange={(ids) => (selectedRowIds = ids)}
				onQuickView={handleQuickView}
				onEdit={handleRowEdit}
				onAddPayment={(loan) => handleQuickPayment(loan, 'payment')}
				onAddReceivedPayment={(loan) => handleQuickPayment(loan, 'received')}
				onDuplicate={handleRowDuplicate}
				onDownloadContract={handleRowDownloadContract}
				{downloadingContractLoanId}
				onDelete={(loan) => (loanPendingDeletion = loan)}
			/>
		{:else if viewModeState.viewMode === 'cards'}
			<CardPagination items={sortedLoans} itemsPerPage={9} itemName="loans">
				{#snippet children(cardLoans)}
					<div class="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
						{#each cardLoans as loan (loan.id)}
							{@const stats = calculateTransactionStats(loan.loanInvestors)}
							<Card.Root
								class="flex h-full flex-col overflow-hidden transition-colors hover:border-primary/20"
							>
								<Card.Header class="px-4 pt-4 pb-1">
									<div class="flex items-start justify-between gap-2">
										<Card.Title class="truncate text-sm sm:text-base"
											>{formatText(loan.loanName)}</Card.Title
										>
										<div class="flex shrink-0 gap-1">
											<Badge
												variant={getLoanTypeBadge(loan.type).variant}
												class={cn('text-[10px]', getLoanTypeBadge(loan.type).className)}
											>
												{formatText(loan.type)}
											</Badge>
											<Badge
												variant={getLoanStatusBadge(loan.status).variant}
												class={cn('text-[10px]', getLoanStatusBadge(loan.status).className)}
											>
												{formatText(loan.status)}
											</Badge>
										</div>
									</div>
								</Card.Header>
								<Card.Content class="flex-1 space-y-3 px-4 pt-0 pb-3">
									<div class="grid grid-cols-2 gap-2">
										<div class="dashboard-metric-cell p-2">
											<p class="text-caption mb-1">Principal</p>
											<p class="text-sm font-medium">{formatCurrency(stats.totalPrincipal)}</p>
										</div>
										<div class="dashboard-metric-cell p-2">
											<p class="text-caption mb-1">Rate</p>
											<p class="text-sm font-medium">{formatPercentage(stats.averageRate)}</p>
										</div>
										<div class="dashboard-metric-cell p-2">
											<p class="text-caption mb-1">Due</p>
											<p class="text-sm font-medium">{formatDateVeryShort(loan.dueDate)}</p>
										</div>
										<div class="dashboard-metric-cell p-2">
											<p class="text-caption mb-1">Interest</p>
											<p class="text-sm font-medium">{formatCurrency(stats.totalInterest)}</p>
										</div>
									</div>
								</Card.Content>
								<Card.Footer class="px-4 pb-4">
									<Button
										variant="outline"
										size="sm"
										class="w-full"
										onclick={() => handleQuickView(loan)}
									>
										Open
									</Button>
								</Card.Footer>
							</Card.Root>
						{/each}
					</div>
				{/snippet}
			</CardPagination>
		{:else}
			<LoanCalendarView loans={sortedLoans} />
		{/if}

		<LoanCreateModal
			open={showCreateModal}
			onOpenChange={(open) => {
				if (!open) closeCreateModal();
				else showCreateModal = true;
			}}
			investors={createModalInvestors}
			borrowers={createModalBorrowers}
			duplicateData={createModalDuplicateData}
			loadingFormData={loadingCreateFormData}
			onSuccess={refreshLoans}
		/>

		<LoanDetailModal
			loan={selectedLoan}
			open={isModalOpen}
			onOpenChange={(open) => {
				isModalOpen = open;
				if (!open) selectedLoan = null;
			}}
			onUpdate={refreshLoans}
			onDuplicate={async (duplicateData) => {
				await openCreateModal(duplicateData);
			}}
		/>

		<LoanQuickPaymentDialog
			loan={quickPaymentLoan}
			kind={quickPaymentKind}
			open={quickPaymentKind !== null}
			onOpenChange={(open) => {
				if (!open) {
					quickPaymentKind = null;
					quickPaymentLoan = null;
				}
			}}
			onSuccess={refreshLoans}
		/>

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
