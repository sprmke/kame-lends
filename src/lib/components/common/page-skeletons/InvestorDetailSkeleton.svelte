<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { INVESTOR_DETAIL_SUMMARY_GRID } from '$lib/summary-grid';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import DataTableSkeleton from './DataTableSkeleton.svelte';
	import SkeletonIdentity from './SkeletonIdentity.svelte';
	import SkeletonMetricGrid from './SkeletonMetricGrid.svelte';
	import { LOANS_TABLE_COLUMNS } from './table-columns';
</script>

<div aria-busy="true" aria-label="Loading investor details" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<SkeletonMetricGrid count={6} gridClass={INVESTOR_DETAIL_SUMMARY_GRID} />

	<div class="flex gap-2 overflow-hidden">
		{#each Array.from({ length: 3 }) as _, index (index)}
			<Skeleton class="h-9 w-24 rounded-2xl" />
		{/each}
	</div>

	<div class="grid gap-2.5 md:grid-cols-2 md:gap-5 2xl:grid-cols-4">
		{#each Array.from({ length: 4 }) as _, index (index)}
			<div class="surface-card space-y-3 p-4">
				<Skeleton class="h-4 w-32" />
				{#each Array.from({ length: 2 }) as _, rowIndex (rowIndex)}
					<div class="rounded-2xl border border-border/50 bg-muted/20 p-3">
						<SkeletonIdentity size="sm" />
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="skeleton-toolbar">
		<div class="mobile-list-toolbar">
			<Skeleton class="h-11 min-w-0 flex-1 rounded-2xl lg:min-w-[12rem]" />
			<div class="mobile-list-toolbar-controls">
				<Skeleton class="h-11 w-28 rounded-2xl" />
				<Skeleton class="h-11 w-28 rounded-2xl" />
			</div>
		</div>
	</div>

	<DataTableSkeleton columns={LOANS_TABLE_COLUMNS} tallRows />
</div>
