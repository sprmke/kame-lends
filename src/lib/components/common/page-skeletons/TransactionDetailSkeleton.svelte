<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
</script>

<div aria-busy="true" aria-label="Loading transaction details" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<Card.Root>
		<Card.Content class="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array.from({ length: 6 }) as _, index (index)}
				<div class="space-y-2">
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-4 w-28" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
