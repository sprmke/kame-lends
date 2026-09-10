<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { getSummaryMetricGridCols, ODD_LAST_TWO_COL_GRID_UNTIL_MD } from '$lib/summary-grid';
	import { cn } from '$lib/utils';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import DataTableSkeleton from './DataTableSkeleton.svelte';
	import { LOANS_TABLE_COLUMNS } from './table-columns';
</script>

<div aria-busy="true" aria-label="Loading investor details" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<div class={cn('grid min-w-0 gap-2.5 md:gap-5', getSummaryMetricGridCols(5), ODD_LAST_TWO_COL_GRID_UNTIL_MD)}>
		{#each Array.from({ length: 5 }) as _, index (index)}
			<div class="surface-card min-w-0 space-y-2 rounded-xl border border-border/60 p-3 md:p-5">
				<Skeleton class="h-3 w-24" />
				<Skeleton class="h-6 w-32" />
				<Skeleton class="h-4 w-20" />
			</div>
		{/each}
	</div>

	<div class="flex gap-2 overflow-hidden">
		{#each Array.from({ length: 3 }) as _, index (index)}
			<Skeleton class="h-9 w-24 rounded-md" />
		{/each}
	</div>

	<div class="grid gap-2.5 md:grid-cols-2 md:gap-5 2xl:grid-cols-4">
		{#each Array.from({ length: 4 }) as _, index (index)}
			<div class="surface-card space-y-3 rounded-xl border border-border/60 p-4">
				<Skeleton class="h-4 w-32" />
				{#each Array.from({ length: 2 }) as _, rowIndex (rowIndex)}
					<div class="space-y-2 rounded-lg border p-3">
						<Skeleton class="h-4 w-[55%]" />
						<Skeleton class="h-3 w-24" />
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="flex flex-wrap gap-2">
		<Skeleton class="h-11 min-w-[12rem] flex-1 rounded-2xl" />
		<Skeleton class="h-11 w-28 rounded-2xl" />
		<Skeleton class="h-11 w-28 rounded-2xl" />
	</div>

	<DataTableSkeleton columns={LOANS_TABLE_COLUMNS} tallRows />
</div>
