<script lang="ts">
	import type { ViewMode } from '$lib/composables/use-responsive-view-mode.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import CardGridSkeleton from './page-skeletons/CardGridSkeleton.svelte';
	import CalendarSkeleton from './page-skeletons/CalendarSkeleton.svelte';
	import DataTableSkeleton from './page-skeletons/DataTableSkeleton.svelte';
	import ListPageFiltersSkeleton from './page-skeletons/ListPageFiltersSkeleton.svelte';
	import ListPageHeaderSkeleton from './page-skeletons/ListPageHeaderSkeleton.svelte';
	import PaginationSkeleton from './page-skeletons/PaginationSkeleton.svelte';
	import SkeletonMetricGrid from './page-skeletons/SkeletonMetricGrid.svelte';
	import TimelineSkeleton from './page-skeletons/TimelineSkeleton.svelte';
	import {
		DEBTS_TABLE_COLUMNS,
		INVESTORS_TABLE_COLUMNS,
		BORROWERS_TABLE_COLUMNS,
		WITNESSES_TABLE_COLUMNS,
		LOANS_TABLE_COLUMNS,
		TRANSACTIONS_TABLE_COLUMNS
	} from './page-skeletons/table-columns';

	export type ListPageSkeletonVariant =
		| 'loans'
		| 'investments'
		| 'borrowed'
		| 'commissioned'
		| 'witnessed'
		| 'groups'
		| 'investors'
		| 'borrowers'
		| 'witnesses'
		| 'debts'
		| 'transactions';

	interface Props {
		variant?: ListPageSkeletonVariant;
		/** Current list view mode; with `ready`, the skeleton matches the resolved layout. */
		viewMode?: ViewMode;
		/** True once the responsive view mode has resolved on the client. */
		ready?: boolean;
		embedded?: boolean;
		showScopeTabs?: boolean;
		/** Loan summary card count (3 when the interest card is hidden). */
		summaryCount?: number;
		summaryGridClass?: string;
	}

	let {
		variant = 'loans',
		viewMode,
		ready = false,
		embedded = false,
		showScopeTabs = false,
		summaryCount = 4,
		summaryGridClass
	}: Props = $props();

	const isLoanScope = $derived(
		variant === 'loans' ||
			variant === 'investments' ||
			variant === 'borrowed' ||
			variant === 'commissioned' ||
			variant === 'witnessed'
	);

	const config = $derived.by(() => {
		switch (variant) {
			case 'loans':
			case 'investments':
			case 'borrowed':
			case 'witnessed':
				return {
					actionCount: 3,
					showDateRange: true,
					showScopeTabs,
					showLoanSummary: true,
					showCommissionSummary: false,
					columns: LOANS_TABLE_COLUMNS,
					cardVariant: 'loan' as const,
					cardGridClass: 'grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3',
					filterCount: 0,
					showMoreFilters: true,
					showViewToggle: true,
					showExport: false,
					showPrimaryAction: false,
					footer: 'none' as const,
					tableRows: 10,
					tallRows: true
				};
			case 'commissioned':
				return {
					actionCount: 3,
					showDateRange: true,
					showScopeTabs,
					showLoanSummary: false,
					showCommissionSummary: true,
					columns: LOANS_TABLE_COLUMNS,
					cardVariant: 'loan' as const,
					cardGridClass: 'grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3',
					filterCount: 0,
					showMoreFilters: true,
					showViewToggle: true,
					showExport: false,
					showPrimaryAction: false,
					footer: 'none' as const,
					tableRows: 10,
					tallRows: true
				};
			case 'investors':
				return {
					actionCount: 2,
					showDateRange: false,
					showScopeTabs: false,
					showLoanSummary: false,
					showCommissionSummary: false,
					columns: INVESTORS_TABLE_COLUMNS,
					cardVariant: 'investor' as const,
					cardGridClass: 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3',
					filterCount: 1,
					showMoreFilters: false,
					showViewToggle: true,
					showExport: false,
					showPrimaryAction: false,
					footer: 'inside' as const,
					tableRows: 10,
					tallRows: false
				};
			case 'borrowers':
				return {
					actionCount: 1,
					showDateRange: false,
					showScopeTabs: false,
					showLoanSummary: false,
					showCommissionSummary: false,
					columns: BORROWERS_TABLE_COLUMNS,
					cardVariant: 'person' as const,
					cardGridClass: 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3',
					filterCount: 1,
					showMoreFilters: false,
					showViewToggle: true,
					showExport: false,
					showPrimaryAction: false,
					footer: 'inside' as const,
					tableRows: 10,
					tallRows: false
				};
			case 'witnesses':
				return {
					actionCount: 1,
					showDateRange: false,
					showScopeTabs: false,
					showLoanSummary: false,
					showCommissionSummary: false,
					columns: WITNESSES_TABLE_COLUMNS,
					cardVariant: 'person' as const,
					cardGridClass: 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3',
					filterCount: 2,
					showMoreFilters: false,
					showViewToggle: true,
					showExport: false,
					showPrimaryAction: false,
					footer: 'inside' as const,
					tableRows: 10,
					tallRows: false
				};
			case 'debts':
				return {
					actionCount: 1,
					showDateRange: false,
					showScopeTabs: false,
					showLoanSummary: false,
					showCommissionSummary: false,
					columns: DEBTS_TABLE_COLUMNS,
					cardVariant: 'debt' as const,
					cardGridClass: 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3',
					filterCount: 0,
					showMoreFilters: true,
					showViewToggle: true,
					showExport: false,
					showPrimaryAction: false,
					footer: 'inside' as const,
					tableRows: 10,
					tallRows: false
				};
			case 'transactions':
				return {
					actionCount: 1,
					showDateRange: false,
					showScopeTabs: false,
					showLoanSummary: false,
					showCommissionSummary: false,
					columns: TRANSACTIONS_TABLE_COLUMNS,
					cardVariant: 'transaction' as const,
					cardGridClass: 'grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3',
					filterCount: 2,
					showMoreFilters: false,
					showViewToggle: true,
					showExport: false,
					showPrimaryAction: false,
					footer: 'outside' as const,
					tableRows: 10,
					tallRows: false
				};
			case 'groups':
				return null;
		}
	});

	const defaultMobileMode = $derived<ViewMode>(isLoanScope ? 'timeline' : 'cards');
	const resolvedMode = $derived<ViewMode | null>(
		ready && viewMode ? viewMode : null
	);
</script>

{#snippet tableSkeleton()}
	{#if config}
		<DataTableSkeleton
			columns={config.columns}
			rows={config.tableRows}
			tallRows={config.tallRows}
			footer={config.footer}
			showActions={variant !== 'transactions'}
		/>
	{/if}
{/snippet}

{#snippet cardsSkeleton()}
	{#if config}
		<CardGridSkeleton count={9} variant={config.cardVariant} class={config.cardGridClass} />
	{/if}
{/snippet}

{#snippet cardsWithPagination()}
	<div class="space-y-3 lg:space-y-6">
		{@render cardsSkeleton()}
		<PaginationSkeleton />
	</div>
{/snippet}

{#snippet mobileSkeleton()}
	{#if defaultMobileMode === 'timeline'}
		<TimelineSkeleton />
	{:else}
		{@render cardsWithPagination()}
	{/if}
{/snippet}

{#snippet contentSkeleton()}
	{#if resolvedMode === 'table'}
		{@render tableSkeleton()}
	{:else if resolvedMode === 'cards'}
		{@render cardsWithPagination()}
	{:else if resolvedMode === 'timeline'}
		<TimelineSkeleton />
	{:else if resolvedMode === 'calendar'}
		<CalendarSkeleton />
	{:else if resolvedMode !== null}
		{@render tableSkeleton()}
	{:else}
		<div class="hidden lg:block">{@render tableSkeleton()}</div>
		<div class="lg:hidden">{@render mobileSkeleton()}</div>
	{/if}
{/snippet}

<div
	aria-busy="true"
	aria-label="Loading page"
	class={embedded ? 'space-y-4' : 'dashboard-page'}
	role="status"
>
	{#if variant === 'groups'}
		{#if !embedded}
			<ListPageHeaderSkeleton actionCount={1} />
		{/if}
		<div class="dashboard-stack">
			{#each ['Your groups', 'Shared with you'] as sectionTitle, sectionIndex (sectionIndex)}
				<section class="dashboard-section">
					<div class="dashboard-section-header">
						<h2 class="dashboard-section-title">{sectionTitle}</h2>
					</div>
					<CardGridSkeleton count={sectionIndex === 0 ? 3 : 2} variant="group" />
				</section>
			{/each}
		</div>
	{:else if config}
		{#if !embedded}
			<ListPageHeaderSkeleton
				actionCount={config.actionCount}
				dateRangeFirst={config.showDateRange}
			/>
		{/if}

		{#if config.showScopeTabs && !embedded}
			<div class="flex gap-0.5 overflow-hidden rounded-xl bg-muted/60 p-0.5 sm:gap-1 sm:rounded-2xl sm:p-1">
				{#each Array.from({ length: 5 }) as _, index (index)}
					<Skeleton class={index === 0 ? 'h-8 w-16 rounded-lg sm:h-9 sm:w-20 sm:rounded-xl' : 'h-8 w-20 rounded-lg sm:h-9 sm:w-24 sm:rounded-xl'} />
				{/each}
			</div>
		{/if}

		{#if config.showDateRange}
			<div class="lg:hidden" aria-hidden="true">
				<Skeleton class="h-11 w-full rounded-2xl" />
			</div>
		{/if}

		{#if config.showLoanSummary}
			<SkeletonMetricGrid count={summaryCount} gridClass={summaryGridClass} />
		{/if}
		{#if config.showCommissionSummary}
			<SkeletonMetricGrid count={4} />
		{/if}

		<ListPageFiltersSkeleton
			showDateRange={false}
			showViewToggle={config.showViewToggle}
			fullViewToggle={isLoanScope}
			filterCount={config.filterCount}
			showMoreFilters={config.showMoreFilters}
			showExport={config.showExport}
			showPrimaryAction={config.showPrimaryAction}
			trailingCount={isLoanScope ? 1 : 0}
		/>

		{@render contentSkeleton()}
	{/if}
</div>
