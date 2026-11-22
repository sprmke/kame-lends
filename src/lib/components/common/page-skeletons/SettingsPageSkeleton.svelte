<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import ListPageHeaderSkeleton from './ListPageHeaderSkeleton.svelte';

	const accountRows = ['Name', 'Email', 'Roles'];
</script>

<div aria-busy="true" aria-label="Loading settings" class="dashboard-stack" role="status">
	<ListPageHeaderSkeleton actionCount={0} />

	<Card.Root>
		<Card.Header class="pb-2">
			<Skeleton class="h-5 w-20" />
		</Card.Header>
		<Card.Content>
			<dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[5rem_1fr]">
				{#each accountRows as _, index (index)}
					<Skeleton class="h-4 w-12" />
					<Skeleton class={index === 1 ? 'h-4 w-3/5 max-w-full' : 'h-4 w-2/5 max-w-full'} />
				{/each}
			</dl>
		</Card.Content>
	</Card.Root>

	{#each Array.from({ length: 4 }) as _, cardIndex (cardIndex)}
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between gap-2 space-y-0">
				<div class="space-y-1">
					<Skeleton class="h-5 w-36 max-w-full" />
					{#if cardIndex === 0}
						<Skeleton class="h-3 w-56 max-w-full" />
					{/if}
				</div>
				<Skeleton class="h-9 w-24 shrink-0 rounded-xl" />
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each Array.from({ length: cardIndex === 0 ? 2 : 3 }) as _, rowIndex (rowIndex)}
					<div class="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="min-w-0 flex-1 space-y-1.5">
							<Skeleton class="h-4 w-40 max-w-full" />
							<Skeleton class="h-3 w-56 max-w-full" />
						</div>
						<Skeleton class="h-9 w-20 shrink-0 rounded-xl" />
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/each}
</div>
