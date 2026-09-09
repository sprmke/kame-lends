<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';
	import DashboardPage from '$lib/components/common/DashboardPage.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SearchFilter from '$lib/components/common/SearchFilter.svelte';
	import MultiSelectFilter from '$lib/components/common/MultiSelectFilter.svelte';
	import RangeFilter from '$lib/components/common/RangeFilter.svelte';
	import CardPagination from '$lib/components/common/CardPagination.svelte';
	import ViewModeToggle from '$lib/components/common/ViewModeToggle.svelte';
	import ListPageSkeleton from '$lib/components/common/ListPageSkeleton.svelte';
	import ConfirmDeleteDialog from '$lib/components/common/ConfirmDeleteDialog.svelte';
	import DebtsTable from '$lib/components/debts/DebtsTable.svelte';
	import DebtCard from '$lib/components/debts/DebtCard.svelte';
	import DebtDetailModal from '$lib/components/debts/DebtDetailModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { createResponsiveViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { isCompletedDebt } from '$lib/debt-calculations';
	import { toast } from '$lib/toast';
	import { PlusCircle, X, Filter, Users } from 'lucide-svelte';
	import type { DebtWithInvestor, Investor } from '$lib/types';

	const INTERVAL_OPTIONS = [
		{ value: 'Daily', label: 'Daily' },
		{ value: 'Weekly', label: 'Weekly' },
		{ value: 'Monthly', label: 'Monthly' },
		{ value: 'Annually', label: 'Annually' }
	];

	let { data } = $props();

	let items = $state<DebtWithInvestor[] | null>(null);
	let investors = $state<Pick<Investor, 'id' | 'name'>[]>([]);

	$effect(() => {
		let active = true;
		data.items.then((value) => {
			if (active) items = value as DebtWithInvestor[];
		});
		return () => {
			active = false;
		};
	});

	const viewModeState = createResponsiveViewMode();
	let searchQuery = $state('');
	let showPastDebts = $state(false);
	let intervalFilter = $state<string[]>([]);
	let selectedInvestors = $state<string[]>([]);
	let minAmount = $state('');
	let maxAmount = $state('');
	let showMoreFilters = $state(false);
	let selectedDebt = $state<DebtWithInvestor | null>(null);
	let showDebtModal = $state(false);
	let debtPendingDeletion = $state<DebtWithInvestor | null>(null);

	onMount(async () => {
		viewModeState.init();
		try {
			const response = await fetch('/api/investors?simple=true');
			const investorData = await response.json();
			if (Array.isArray(investorData)) {
				investors = investorData
					.map((inv: { id: number; name: string }) => ({ id: inv.id, name: inv.name }))
					.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
			}
		} catch (error) {
			console.error('Failed to load investors', error);
		}
	});

	async function refreshDebts() {
		await invalidate('app:debts');
		items = (await data.items) as DebtWithInvestor[];
	}

	function handleQuickView(debt: DebtWithInvestor) {
		selectedDebt = debt;
		showDebtModal = true;
	}

	function handleRowEdit(debt: DebtWithInvestor) {
		goto(`/debts/${debt.id}?edit=1`);
	}

	async function handleRowDelete(debt: DebtWithInvestor) {
		const response = await fetch(`/api/debts/${debt.id}`, { method: 'DELETE' });
		if (!response.ok) {
			toast.error('Failed to delete borrowing');
			throw new Error('Failed to delete borrowing');
		}
		toast.success('Borrowing deleted');
		await refreshDebts();
	}

	function clearFilters() {
		searchQuery = '';
		showPastDebts = false;
		intervalFilter = [];
		selectedInvestors = [];
		minAmount = '';
		maxAmount = '';
	}

	const hasActiveAmountFilters = $derived(
		minAmount !== '' || maxAmount !== '' || selectedInvestors.length > 0
	);

	const hasActiveFilters = $derived(
		searchQuery !== '' || showPastDebts || intervalFilter.length > 0 || hasActiveAmountFilters
	);

	const filteredDebts = $derived(
		(items ?? []).filter((debt) => {
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				if (
					!debt.name.toLowerCase().includes(q) &&
					!debt.investor.name.toLowerCase().includes(q) &&
					!(debt.notes?.toLowerCase().includes(q) ?? false)
				) {
					return false;
				}
			}

			if (!showPastDebts && isCompletedDebt(debt)) return false;

			if (intervalFilter.length > 0 && !intervalFilter.includes(debt.interestInterval)) {
				return false;
			}

			if (selectedInvestors.length > 0 && !selectedInvestors.includes(String(debt.investor.id))) {
				return false;
			}

			const amount = parseFloat(debt.amount);
			if (minAmount !== '' && amount < parseFloat(minAmount)) return false;
			if (maxAmount !== '' && amount > parseFloat(maxAmount)) return false;

			return true;
		})
	);

	const sortedDebts = $derived(
		[...filteredDebts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
	);

	const investorFilterOptions = $derived(
		investors.map((investor) => ({ value: String(investor.id), label: investor.name }))
	);
</script>

<svelte:head><title>Borrowings</title></svelte:head>

{#if items === null}
	<ListPageSkeleton variant="debts" />
{:else}
	<DashboardPage>
		<PageHeader title="Borrowings" showPriceToggle={true}>
			<ViewModeToggle
				viewMode={viewModeState.viewMode}
				onViewModeChange={(mode) => viewModeState.setViewMode(mode)}
				hasData={items.length > 0}
			/>
			<Button href="/debts/new" size="sm">
				<PlusCircle class="mr-2 h-4 w-4" />
				Add Borrowing
			</Button>
		</PageHeader>

		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				<SearchFilter
					value={searchQuery}
					onChange={(value) => {
						searchQuery = value;
					}}
					placeholder="Search borrowings..."
				/>

				<Select.Root
					type="single"
					value={showPastDebts ? 'show' : 'hide'}
					onValueChange={(value) => {
						showPastDebts = value === 'show';
					}}
				>
					<Select.Trigger class="hidden h-9 w-full xl:flex xl:w-[200px]">
						{showPastDebts ? 'Show Repaid' : 'Hide Repaid'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="hide">Hide Repaid</Select.Item>
						<Select.Item value="show">Show Repaid</Select.Item>
					</Select.Content>
				</Select.Root>

				<MultiSelectFilter
					options={INTERVAL_OPTIONS}
					selected={intervalFilter}
					onChange={(value) => {
						intervalFilter = value;
					}}
					placeholder="Accrual Period"
					allLabel="All Periods"
					triggerClassName="hidden h-9 w-full xl:flex xl:w-[180px]"
				/>

				<Button
					variant={showMoreFilters ? 'secondary' : 'outline'}
					size="sm"
					class="relative h-9 px-3"
					onclick={() => (showMoreFilters = !showMoreFilters)}
				>
					<Filter class="h-4 w-4 xl:mr-2" />
					<span class="hidden xl:inline">{showMoreFilters ? 'Less' : 'More'} Filters</span>
					{#if hasActiveAmountFilters}
						<span class="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary"></span>
					{/if}
				</Button>

				{#if hasActiveFilters}
					<Button variant="outline" size="sm" class="h-9 px-3" onclick={clearFilters}>
						<X class="h-4 w-4 xl:mr-2" />
						<span class="hidden xl:inline">Clear All</span>
					</Button>
				{/if}
			</div>

			{#if showMoreFilters}
				<div class="space-y-3 rounded-lg border bg-muted/30 p-4">
					<div class="grid grid-cols-2 gap-3 border-b pb-3 xl:hidden">
						<div class="space-y-2">
							<p class="text-xs font-semibold">Repaid Borrowings</p>
							<Select.Root
								type="single"
								value={showPastDebts ? 'show' : 'hide'}
								onValueChange={(value) => {
									showPastDebts = value === 'show';
								}}
							>
								<Select.Trigger class="w-full">
									{showPastDebts ? 'Show Repaid' : 'Hide Repaid'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="hide">Hide Repaid</Select.Item>
									<Select.Item value="show">Show Repaid</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<p class="text-xs font-semibold">Accrual Period</p>
							<MultiSelectFilter
								options={INTERVAL_OPTIONS}
								selected={intervalFilter}
								onChange={(value) => {
									intervalFilter = value;
								}}
								placeholder="Accrual Period"
								allLabel="All Periods"
								triggerClassName="w-full"
							/>
						</div>
					</div>

					<RangeFilter
						label="Principal Amount"
						minValue={minAmount}
						maxValue={maxAmount}
						onMinChange={(value) => {
							minAmount = value;
						}}
						onMaxChange={(value) => {
							maxAmount = value;
						}}
						minPlaceholder="Min (₱)"
						maxPlaceholder="Max (₱)"
					/>

					<div class="space-y-2 border-t pt-3">
						<p class="flex items-center gap-1 text-xs font-semibold">
							<Users class="h-3.5 w-3.5" />
							Investors
							{#if selectedInvestors.length > 0}({selectedInvestors.length}){/if}
						</p>
						<MultiSelectFilter
							options={investorFilterOptions}
							selected={selectedInvestors}
							onChange={(value) => {
								selectedInvestors = value;
							}}
							placeholder="All Investors"
							allLabel="All Investors"
							triggerClassName="w-full"
						/>
					</div>
				</div>
			{/if}
		</div>

		{#if sortedDebts.length === 0}
			<p class="text-muted-foreground">No borrowings match your filters.</p>
		{:else if viewModeState.viewMode === 'table'}
			<DebtsTable
				debts={sortedDebts}
				onQuickView={handleQuickView}
				onEdit={handleRowEdit}
				onDelete={(debt) => (debtPendingDeletion = debt)}
			/>
		{:else}
			<CardPagination items={sortedDebts} itemsPerPage={9} itemName="borrowings">
				{#snippet children(cardDebts)}
					<div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
						{#each cardDebts as debt (debt.id)}
							<DebtCard {debt} onQuickView={() => handleQuickView(debt)} />
						{/each}
					</div>
				{/snippet}
			</CardPagination>
		{/if}
	</DashboardPage>

	<DebtDetailModal
		debt={selectedDebt}
		open={showDebtModal}
		onOpenChange={(open) => {
			showDebtModal = open;
			if (!open) selectedDebt = null;
		}}
		onUpdate={refreshDebts}
	/>

	<ConfirmDeleteDialog
		open={debtPendingDeletion !== null}
		onOpenChange={(open) => {
			if (!open) debtPendingDeletion = null;
		}}
		title="Delete borrowing?"
		description={debtPendingDeletion
			? `This will permanently delete "${debtPendingDeletion.name}".`
			: ''}
		onConfirm={async () => {
			if (debtPendingDeletion) await handleRowDelete(debtPendingDeletion);
		}}
	/>
{/if}
