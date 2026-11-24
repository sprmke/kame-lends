<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import SkeletonMetricGrid from './SkeletonMetricGrid.svelte';
</script>

<div aria-busy="true" aria-label="Loading group" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<div class="grid h-11 w-full grid-cols-4 items-center gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
		{#each Array.from({ length: 4 }) as _, index (index)}
			<Skeleton class="h-full rounded-lg" />
		{/each}
	</div>

	<div class="space-y-4">
		<Card.Root class="border-destructive/40">
			<Card.Header class="pb-2">
				<Skeleton class="h-5 w-32" />
			</Card.Header>
			<Card.Content>
				<Skeleton class="h-4 w-64 max-w-full" />
			</Card.Content>
		</Card.Root>

		<SkeletonMetricGrid count={4} />

		<div class="grid gap-4 sm:grid-cols-2">
			{#each Array.from({ length: 2 }) as _, cardIndex (cardIndex)}
				<Card.Root>
					<Card.Header class="pb-2">
						<Skeleton class="h-5 w-20" />
					</Card.Header>
					<Card.Content class="space-y-2">
						{#each Array.from({ length: 3 }) as _, rowIndex (rowIndex)}
							<div class="flex items-center justify-between gap-3 px-1 py-1.5">
								<Skeleton class="h-4 w-24" />
								<Skeleton class="h-4 w-16" />
							</div>
						{/each}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between gap-2 pb-2">
				<Skeleton class="h-5 w-24" />
				<Skeleton class="h-4 w-16" />
			</Card.Header>
			<Card.Content class="space-y-1">
				{#each Array.from({ length: 3 }) as _, rowIndex (rowIndex)}
					<div class="flex items-center justify-between gap-3 rounded-lg px-2 py-2">
						<Skeleton class="h-4 w-2/5" />
						<Skeleton class="h-3 w-20" />
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	</div>
</div>
