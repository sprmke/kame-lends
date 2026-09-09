<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { getSummaryMetricGridCols } from '$lib/summary-grid';
	import { cn } from '$lib/utils';

	const activityItemCount = 3;
	const summaryMetricCount = 5;
</script>

{#snippet summaryMetric()}
	<Card.Root class="surface-card-interactive border-border/60">
		<Card.Content class="p-3">
			<div class="flex items-center justify-between gap-2">
				<Skeleton class="h-3 w-24" />
				<Skeleton class="icon-well-sm" />
			</div>
			<Skeleton class="mt-1.5 h-5 w-36" />
			<Skeleton class="mt-0.5 h-3 w-28" />
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
	<Card.Root class="relative flex h-full flex-col overflow-hidden border-border/60">
		<Skeleton class="dashboard-panel-stripe" />
		<Card.Header class="space-y-0 px-3 pt-4 pb-1.5">
			<div class="flex items-start justify-between gap-2">
				<Skeleton class="h-4 w-32" />
				<Skeleton class="icon-well-sm" />
			</div>
		</Card.Header>
		<Card.Content class="min-w-0 flex-1 px-3 pt-0 pb-3">
			<div class="max-h-64 space-y-2 overflow-hidden pr-1">
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
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div class="space-y-0.5">
			<Skeleton class="h-2.5 w-20" />
			<Skeleton class="h-7 w-40 md:h-8 md:w-48" />
			<Skeleton class="h-4 w-full max-w-sm" />
		</div>
	</div>

	<div class={cn('grid gap-2.5 sm:gap-3', getSummaryMetricGridCols(summaryMetricCount))}>
		{#each Array.from({ length: summaryMetricCount }) as _, i (i)}
			{@render summaryMetric()}
		{/each}
	</div>

	<section class="dashboard-section">
		{@render sectionHeading()}
		<div class="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-4">
			{#each Array.from({ length: 4 }) as _, i (i)}
				{@render activityPanel()}
			{/each}
		</div>
	</section>
</div>
