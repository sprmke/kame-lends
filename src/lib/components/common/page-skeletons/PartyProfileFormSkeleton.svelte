<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import SkeletonField from './SkeletonField.svelte';
</script>

<div aria-busy="true" aria-label="Loading profile" class="space-y-4" role="status">
	<Card.Root>
		<Card.Header>
			<Skeleton class="h-5 w-28" />
		</Card.Header>
		<Card.Content class="space-y-4">
			<SkeletonField control labelWidth="w-20" valueWidth="w-full" />
			<SkeletonField control labelWidth="w-28" valueWidth="w-full" />
			<SkeletonField control labelWidth="w-24" valueWidth="w-full" />
			<SkeletonField control labelWidth="w-16" valueWidth="w-full" />
			<SkeletonField tall labelWidth="w-12" valueWidth="w-full" />
			<div class="grid gap-4 lg:grid-cols-2">
				<SkeletonField control labelWidth="w-16" valueWidth="w-full" />
				<SkeletonField control labelWidth="w-24" valueWidth="w-full" />
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Skeleton class="h-5 w-36" />
		</Card.Header>
		<Card.Content class="space-y-3">
			{#each Array.from({ length: 2 }) as _, index (index)}
				<div class="rounded-2xl border border-border/50 bg-muted/20 p-3">
					<SkeletonField control labelWidth="w-32" valueWidth="w-full" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
