<script lang="ts">
	import DataTableSkeleton from './page-skeletons/DataTableSkeleton.svelte';
	import ListPageFiltersSkeleton from './page-skeletons/ListPageFiltersSkeleton.svelte';
	import ListPageHeaderSkeleton from './page-skeletons/ListPageHeaderSkeleton.svelte';
	import {
		INVESTORS_TABLE_COLUMNS,
		LOANS_TABLE_COLUMNS,
		TRANSACTIONS_TABLE_COLUMNS
	} from './page-skeletons/table-columns';

	export type ListPageSkeletonVariant = 'loans' | 'investors' | 'debts' | 'transactions';

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
					columns: LOANS_TABLE_COLUMNS,
					tallRows: true
				};
			case 'investors':
				return {
					actionCount: 1,
					showMoreFilters: false,
					columns: INVESTORS_TABLE_COLUMNS,
					tallRows: false
				};
			case 'debts':
				return {
					actionCount: 2,
					showMoreFilters: true,
					columns: TRANSACTIONS_TABLE_COLUMNS,
					tallRows: false
				};
			case 'transactions':
				return {
					actionCount: 4,
					showMoreFilters: true,
					columns: TRANSACTIONS_TABLE_COLUMNS,
					tallRows: false
				};
		}
	});
</script>

<div aria-busy="true" aria-label="Loading page" class="dashboard-page" role="status">
	<ListPageHeaderSkeleton actionCount={config.actionCount} />
	<ListPageFiltersSkeleton showMoreFilters={config.showMoreFilters} />
	<DataTableSkeleton columns={config.columns} tallRows={config.tallRows} />
</div>
