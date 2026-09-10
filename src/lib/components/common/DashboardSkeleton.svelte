<script lang="ts">
	import DashboardSummarySkeleton from './DashboardSummarySkeleton.svelte';
	import DashboardChartsSkeleton from './DashboardChartsSkeleton.svelte';
</script>

<div aria-busy="true" aria-label="Loading dashboard" class="space-y-8 md:space-y-10" role="status">
	<DashboardSummarySkeleton />
	<DashboardChartsSkeleton />
</div>
