<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { INVESTOR_DETAIL_SUMMARY_GRID } from '$lib/summary-grid';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import ActivityCardsSkeleton from './ActivityCardsSkeleton.svelte';
	import SkeletonMetricGrid from './SkeletonMetricGrid.svelte';
</script>

<div aria-busy="true" aria-label="Loading investor details" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<div class="grid h-11 w-full max-w-lg grid-cols-3 items-center gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
		{#each Array.from({ length: 3 }) as _, index (index)}
			<Skeleton class="h-full rounded-lg" />
		{/each}
	</div>

	<SkeletonMetricGrid count={8} gridClass={INVESTOR_DETAIL_SUMMARY_GRID} sub />

	<ActivityCardsSkeleton />
</div>
