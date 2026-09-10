<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ODD_LAST_TWO_COL_GRID_UNTIL_MD } from '$lib/summary-grid';
	import { cn } from '$lib/utils';

	interface Props {
		metricCount?: number;
		showTopMetrics?: boolean;
		scheduleRows?: number;
	}

	let { metricCount = 5, showTopMetrics = true, scheduleRows = 3 }: Props = $props();
</script>

<div aria-busy="true" aria-label="Loading borrowing details" class="space-y-4" role="status">
	{#if showTopMetrics}
		<div class={cn(ODD_LAST_TWO_COL_GRID_UNTIL_MD, 'grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5')}>
			{#each Array.from({ length: metricCount }) as _, index (index)}
				<div class="dashboard-metric-cell space-y-2">
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-4 w-24" />
				</div>
			{/each}
		</div>
	{/if}

	<Card.Root class="border-primary/20 bg-primary/5">
		<Card.Header class="pb-3">
			<div class="flex items-center gap-2">
				<Skeleton class="h-5 w-5 rounded-sm" />
				<Skeleton class="h-5 w-36" />
			</div>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class={cn(ODD_LAST_TWO_COL_GRID_UNTIL_MD, 'grid grid-cols-2 gap-3 md:grid-cols-3')}>
				{#each Array.from({ length: 9 }) as _, index (index)}
					<div class="space-y-2 rounded-lg border bg-background p-3">
						<Skeleton class="h-3 w-20" />
						<Skeleton class="h-5 w-28" />
					</div>
				{/each}
			</div>

			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<Skeleton class="h-4 w-4 rounded-sm" />
					<Skeleton class="h-4 w-32" />
				</div>
				{#each Array.from({ length: scheduleRows }) as _, index (index)}
					<div
						class="flex items-start justify-between gap-3 rounded border bg-background p-3"
					>
						<div class="flex min-w-0 items-center gap-2">
							<Skeleton class="h-4 w-6" />
							<Skeleton class="h-4 w-24" />
							<Skeleton class="h-5 w-16 rounded-full" />
						</div>
						<div class="space-y-1.5 text-right">
							<Skeleton class="ml-auto h-5 w-32" />
							<Skeleton class="ml-auto h-3 w-40" />
						</div>
					</div>
				{/each}
				<Skeleton class="mt-2 h-11 w-full rounded-md" />
			</div>
		</Card.Content>
	</Card.Root>
</div>
