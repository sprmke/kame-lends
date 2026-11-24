<script lang="ts">
	import SkeletonMetricGrid from './page-skeletons/SkeletonMetricGrid.svelte';
	import ListPageHeaderSkeleton from './page-skeletons/ListPageHeaderSkeleton.svelte';
	import ActivityCardsSkeleton from './page-skeletons/ActivityCardsSkeleton.svelte';
</script>

<div aria-busy="true" aria-label="Loading dashboard summary" class="space-y-6 md:space-y-8" role="status">
	<ListPageHeaderSkeleton actionCount={1} />

	<SkeletonMetricGrid count={4} />

	<section class="dashboard-section">
		<div class="dashboard-section-header">
			<div>
				<p class="section-eyebrow">Activity</p>
				<h2 class="dashboard-section-title">Needs attention</h2>
			</div>
		</div>
		<ActivityCardsSkeleton />
	</section>
</div>
