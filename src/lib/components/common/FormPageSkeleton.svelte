<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SkeletonField from './page-skeletons/SkeletonField.svelte';
</script>

<div aria-busy="true" aria-label="Loading form" class="space-y-4" role="status">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<Skeleton class="h-7 w-40 md:h-8" />
		<Skeleton class="h-9 w-20 rounded-2xl" />
	</div>

	<Card.Root class="border-border/60">
		<Card.Content class="space-y-4 p-3 md:p-4">
			<div class="grid gap-3 sm:grid-cols-2">
				{#each Array.from({ length: 6 }) as _, i (i)}
					<SkeletonField control labelWidth="w-24" valueWidth="w-full" />
				{/each}
			</div>
			<SkeletonField tall labelWidth="w-16" valueWidth="w-full" />
			<div class="flex justify-end gap-2">
				<Skeleton class="h-9 w-24 rounded-2xl" />
				<Skeleton class="h-9 w-28 rounded-2xl" />
			</div>
		</Card.Content>
	</Card.Root>
</div>
