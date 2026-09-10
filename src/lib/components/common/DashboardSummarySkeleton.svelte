<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SkeletonMetricGrid from './page-skeletons/SkeletonMetricGrid.svelte';
	import ListPageHeaderSkeleton from './page-skeletons/ListPageHeaderSkeleton.svelte';

	const activityItemCount = 3;
</script>

{#snippet activityLoanRow()}
	<div class="dashboard-activity-item">
		<div class="flex items-start justify-between gap-2">
			<Skeleton class="h-4 w-[55%]" />
			<Skeleton class="h-5 w-14 shrink-0 rounded-full" />
		</div>
		<div class="flex items-center justify-between">
			<Skeleton class="h-3 w-20" />
			<Skeleton class="h-3 w-16" />
		</div>
	</div>
{/snippet}

{#snippet activityPanel()}
	<Card.Root class="flex h-full flex-col overflow-hidden border-border/60">
		<Card.Header class="space-y-0 pb-2">
			<div class="flex items-center justify-between gap-2">
				<Skeleton class="h-4 w-32" />
				<Skeleton class="icon-well-xs" />
			</div>
		</Card.Header>
		<Card.Content class="min-w-0 flex-1">
			<div class="dashboard-activity-list overflow-hidden">
				{#each Array.from({ length: activityItemCount }) as _, i (i)}
					{@render activityLoanRow()}
				{/each}
			</div>
		</Card.Content>
	</Card.Root>
{/snippet}

<div aria-busy="true" aria-label="Loading dashboard summary" class="space-y-6 md:space-y-8" role="status">
	<ListPageHeaderSkeleton actionCount={1} />

	<SkeletonMetricGrid count={4} />

	<section class="dashboard-section">
		<div class="dashboard-section-header">
			<div>
				<Skeleton class="h-2.5 w-16" />
				<Skeleton class="mt-1 h-4 w-36" />
			</div>
		</div>
		<div class="grid gap-2.5 md:grid-cols-2 md:gap-5 2xl:grid-cols-4">
			{#each Array.from({ length: 4 }) as _, i (i)}
				{@render activityPanel()}
			{/each}
		</div>
	</section>
</div>
