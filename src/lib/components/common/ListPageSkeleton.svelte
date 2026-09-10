<script lang="ts">
	import DataTableSkeleton from './page-skeletons/DataTableSkeleton.svelte';
	import ListPageFiltersSkeleton from './page-skeletons/ListPageFiltersSkeleton.svelte';
	import ListPageHeaderSkeleton from './page-skeletons/ListPageHeaderSkeleton.svelte';
	import SkeletonMetricGrid from './page-skeletons/SkeletonMetricGrid.svelte';
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
		| 'investors'
		| 'borrowers'
		| 'witnesses'
		| 'debts'
		| 'transactions';

	interface Props {
		variant?: ListPageSkeletonVariant;
	}

	let { variant = 'loans' }: Props = $props();

	const config = $derived.by(() => {
		switch (variant) {
			case 'loans':
				return {
					actionCount: 5,
					showMoreFilters: true,
					showSummary: true,
					columns: LOANS_TABLE_COLUMNS,
					tallRows: true
				};
			case 'investors':
				return {
					actionCount: 1,
					showMoreFilters: false,
					showSummary: false,
					columns: INVESTORS_TABLE_COLUMNS,
					tallRows: false
				};
			case 'borrowers':
				return {
					actionCount: 2,
					showMoreFilters: false,
					showSummary: false,
					columns: BORROWERS_TABLE_COLUMNS,
					tallRows: false
				};
			case 'witnesses':
				return {
					actionCount: 2,
					showMoreFilters: false,
					showSummary: false,
					columns: WITNESSES_TABLE_COLUMNS,
					tallRows: false
				};
			case 'debts':
				return {
					actionCount: 2,
					showMoreFilters: true,
					showSummary: false,
					columns: DEBTS_TABLE_COLUMNS,
					tallRows: false
				};
			case 'transactions':
				return {
					actionCount: 4,
					showMoreFilters: true,
					showSummary: false,
					columns: TRANSACTIONS_TABLE_COLUMNS,
					tallRows: false
				};
		}
	});
</script>

<div aria-busy="true" aria-label="Loading page" class="dashboard-page" role="status">
	<ListPageHeaderSkeleton actionCount={config.actionCount} />
	{#if config.showSummary}
		<SkeletonMetricGrid count={4} />
	{/if}
	<ListPageFiltersSkeleton showMoreFilters={config.showMoreFilters} />
	<DataTableSkeleton columns={config.columns} tallRows={config.tallRows} />
</div>
