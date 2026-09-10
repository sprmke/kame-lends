<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { BORROWER_DETAIL_SUMMARY_GRID } from '$lib/summary-grid';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import SkeletonField from './SkeletonField.svelte';
	import SkeletonIdentity from './SkeletonIdentity.svelte';
	import SkeletonMetricGrid from './SkeletonMetricGrid.svelte';
</script>

<div aria-busy="true" aria-label="Loading borrower details" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<Card.Root>
		<Card.Content class="grid gap-4 p-4 sm:grid-cols-2">
			{#each Array.from({ length: 4 }) as _, index (index)}
				<SkeletonField />
			{/each}
		</Card.Content>
	</Card.Root>

	<SkeletonMetricGrid count={6} gridClass={BORROWER_DETAIL_SUMMARY_GRID} />

	<div class="space-y-3">
		<Skeleton class="h-5 w-28" />
		{#each Array.from({ length: 2 }) as _, index (index)}
			<Card.Root>
				<Card.Content class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
					<SkeletonIdentity />
					<div class="flex flex-wrap items-center gap-2">
						<Skeleton class="h-5 w-16 rounded-full" />
						<Skeleton class="h-5 w-20 rounded-full" />
						<Skeleton class="h-9 w-16 rounded-2xl" />
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
