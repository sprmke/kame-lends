<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import ListPageHeaderSkeleton from './ListPageHeaderSkeleton.svelte';
</script>

<div aria-busy="true" aria-label="Loading settings" class="dashboard-stack" role="status">
	<ListPageHeaderSkeleton actionCount={0} />

	<Card.Root>
		<Card.Header class="pb-2">
			<Skeleton class="h-5 w-20" />
		</Card.Header>
		<Card.Content class="grid gap-x-4 gap-y-3 sm:grid-cols-[4.5rem_1fr]">
			{#each Array.from({ length: 3 }) as _, index (index)}
				<Skeleton class="h-3 w-12" />
				<Skeleton class="h-4 w-48 max-w-full" />
			{/each}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Skeleton class="h-5 w-36" />
		</Card.Header>
		<Card.Content class="space-y-3">
			{#each Array.from({ length: 3 }) as _, index (index)}
				<div class="space-y-2 rounded-lg border p-3">
					<Skeleton class="h-4 w-32" />
					<Skeleton class="h-11 w-full rounded-2xl" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
