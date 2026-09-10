<script lang="ts">
	import { getSummaryMetricGridCols, ODD_LAST_TWO_COL_GRID_UNTIL_MD } from '$lib/summary-grid';
	import { cn } from '$lib/utils';
	import SkeletonMetricCard from './SkeletonMetricCard.svelte';

	interface Props {
		count?: number;
		gridClass?: string;
		class?: string;
	}

	let { count = 4, gridClass, class: className }: Props = $props();

	const cols = $derived(gridClass ?? getSummaryMetricGridCols(count));
</script>

<div class={cn('grid min-w-0 items-stretch gap-2.5 md:gap-5', cols, ODD_LAST_TWO_COL_GRID_UNTIL_MD, className)}>
	{#each Array.from({ length: count }) as _, index (index)}
		<SkeletonMetricCard />
	{/each}
</div>
