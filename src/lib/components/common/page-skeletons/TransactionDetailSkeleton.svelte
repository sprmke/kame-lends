<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import ListPageHeaderSkeleton from './ListPageHeaderSkeleton.svelte';

	interface Props {
		/** Detail modal keeps the dialog header instead of the page header. */
		variant?: 'page' | 'modal';
	}

	let { variant = 'page' }: Props = $props();
</script>

{#snippet detailCells()}
	<div class="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each Array.from({ length: 6 }) as _, index (index)}
			<div class="space-y-1">
				<Skeleton class="h-3 w-16" />
				{#if index === 2 || index === 3}
					<Skeleton class="h-5 w-16 rounded-full" />
				{:else}
					<Skeleton class="h-4 w-3/5 max-w-[12rem]" />
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#if variant === 'modal'}
	<div class="space-y-4" aria-busy="true" aria-label="Loading transaction details" role="status">
		<Card.Root>
			<Card.Content class="p-0">
				{@render detailCells()}
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div class="dashboard-stack" aria-busy="true" aria-label="Loading transaction details" role="status">
		<ListPageHeaderSkeleton actionCount={1} />
		<Card.Root>
			<Card.Content class="p-0">
				{@render detailCells()}
			</Card.Content>
		</Card.Root>
	</div>
{/if}
