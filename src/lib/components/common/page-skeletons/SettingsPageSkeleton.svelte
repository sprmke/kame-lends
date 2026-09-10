<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import ListPageHeaderSkeleton from './ListPageHeaderSkeleton.svelte';
	import SkeletonField from './SkeletonField.svelte';
</script>

<div aria-busy="true" aria-label="Loading settings" class="dashboard-stack" role="status">
	<ListPageHeaderSkeleton actionCount={0} />

	<Card.Root>
		<Card.Header class="pb-2">
			<Skeleton class="h-5 w-20" />
		</Card.Header>
		<Card.Content class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
			{#each Array.from({ length: 3 }) as _, index (index)}
				<SkeletonField />
			{/each}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Skeleton class="h-5 w-36" />
		</Card.Header>
		<Card.Content class="space-y-3">
			{#each Array.from({ length: 3 }) as _, index (index)}
				<div class="rounded-2xl border border-border/50 bg-muted/20 p-3">
					<SkeletonField control labelWidth="w-32" valueWidth="w-full" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
