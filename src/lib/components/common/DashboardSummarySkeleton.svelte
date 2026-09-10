<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { getSummaryMetricGridCols, ODD_LAST_TWO_COL_GRID_UNTIL_MD } from '$lib/summary-grid';
	import { cn } from '$lib/utils';

	const activityItemCount = 3;
	const summaryMetricCount = 4;
</script>

{#snippet summaryMetric()}
	<Card.Root class="min-w-0 surface-card-interactive border-border/60">
		<Card.Content class="min-w-0 space-y-1 p-3 md:p-5">
			<div class="flex items-center justify-between gap-2">
				<Skeleton class="h-3 w-24" />
				<Skeleton class="icon-well-sm" />
			</div>
			<Skeleton class="mt-1 h-6 w-36" />
			<Skeleton class="mt-1 h-4 w-28" />
		</Card.Content>
	</Card.Root>
{/snippet}

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

{#snippet sectionHeading()}
	<div>
		<Skeleton class="h-2.5 w-16" />
		<Skeleton class="mt-1 h-4 w-36" />
	</div>
{/snippet}

<div aria-busy="true" aria-label="Loading dashboard summary" role="status">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div class="max-w-2xl space-y-2">
			<Skeleton class="hidden h-3 w-24 lg:block" />
			<Skeleton class="h-8 w-48 md:h-9 md:w-56" />
			<Skeleton class="hidden h-4 w-full max-w-sm lg:block" />
		</div>
	</div>

	<div
		class={cn(
			'grid min-w-0 gap-2.5 md:gap-5',
			getSummaryMetricGridCols(summaryMetricCount),
			ODD_LAST_TWO_COL_GRID_UNTIL_MD
		)}
	>
		{#each Array.from({ length: summaryMetricCount }) as _, i (i)}
			{@render summaryMetric()}
		{/each}
	</div>

	<section class="dashboard-section">
		{@render sectionHeading()}
		<div class="grid gap-2.5 md:grid-cols-2 md:gap-5 2xl:grid-cols-4">
			{#each Array.from({ length: 4 }) as _, i (i)}
				{@render activityPanel()}
			{/each}
		</div>
	</section>
</div>
