<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div aria-busy="true" aria-label="Loading form" class="space-y-4" role="status">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<Skeleton class="h-7 w-40 md:h-8" />
		<Skeleton class="h-8 w-20 rounded-md" />
	</div>

	<Card.Root class="border-border/60">
		<Card.Content class="space-y-4 p-3 md:p-4">
			<div class="grid gap-3 sm:grid-cols-2">
				{#each Array.from({ length: 6 }) as _, i (i)}
					<div class="space-y-1.5">
						<Skeleton class="h-3 w-24" />
						<Skeleton class="h-9 w-full rounded-md" />
					</div>
				{/each}
			</div>
			<div class="space-y-1.5">
				<Skeleton class="h-3 w-16" />
				<Skeleton class="h-20 w-full rounded-md" />
			</div>
			<div class="flex justify-end gap-2">
				<Skeleton class="h-8 w-24 rounded-md" />
				<Skeleton class="h-8 w-28 rounded-md" />
			</div>
		</Card.Content>
	</Card.Root>
</div>
