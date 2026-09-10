<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import SkeletonField from './SkeletonField.svelte';
</script>

<div aria-busy="true" aria-label="Loading transaction details" class="dashboard-stack" role="status">
	<DetailHeaderSkeleton />

	<Card.Root>
		<Card.Content class="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array.from({ length: 6 }) as _, index (index)}
				<SkeletonField />
			{/each}
		</Card.Content>
	</Card.Root>
</div>
