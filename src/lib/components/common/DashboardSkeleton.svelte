<script lang="ts">
	import DashboardSummarySkeleton from './DashboardSummarySkeleton.svelte';
	import DashboardChartsSkeleton from './DashboardChartsSkeleton.svelte';

	interface Props {
		showGroupsColumn?: boolean;
	}

	let { showGroupsColumn = false }: Props = $props();
</script>

<div aria-busy="true" aria-label="Loading dashboard" class="space-y-6" role="status">
	<DashboardSummarySkeleton />
	<DashboardChartsSkeleton {showGroupsColumn} />
</div>
