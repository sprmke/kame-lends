<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
</script>

<div aria-busy="true" aria-label="Loading borrower details" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<Card.Root>
		<Card.Content class="grid gap-4 p-4 sm:grid-cols-2">
			{#each Array.from({ length: 4 }) as _, index (index)}
				<div class="space-y-2">
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-4 w-full max-w-xs" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>

	<div class="space-y-3">
		<Skeleton class="h-6 w-28" />
		{#each Array.from({ length: 2 }) as _, index (index)}
			<Card.Root>
				<Card.Content class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="min-w-0 space-y-2">
						<Skeleton class="h-4 w-40" />
						<Skeleton class="h-3 w-24" />
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<Skeleton class="h-5 w-16 rounded-full" />
						<Skeleton class="h-5 w-20 rounded-full" />
						<Skeleton class="h-9 w-16 rounded-md" />
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
