<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ODD_LAST_TWO_COL_GRID, ODD_LAST_TWO_COL_GRID_UNTIL_MD } from '$lib/summary-grid';
	import { cn } from '$lib/utils';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';

	interface Props {
		/** Page detail adds the header; modal detail renders inside the dialog body. */
		variant?: 'page' | 'modal';
		scheduleRows?: number;
	}

	let { variant = 'page', scheduleRows = 3 }: Props = $props();
</script>

{#snippet summaryCells()}
	<div class={cn(ODD_LAST_TWO_COL_GRID, 'grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5')}>
		{#each Array.from({ length: 5 }) as _, index (index)}
			<div class="rounded-lg bg-muted/50 p-3">
				<Skeleton class="mb-1 h-3 w-16" />
				<Skeleton class={index === 3 ? 'h-5 w-16 rounded-full' : 'h-4 w-20 max-w-full'} />
			</div>
		{/each}
	</div>
{/snippet}

{#snippet interestOverview()}
	<Card.Root class="border-primary/20 bg-primary/5">
		<Card.Header class="pb-3">
			<div class="flex items-center gap-2">
				<Skeleton class="h-5 w-5 rounded-sm" />
				<Skeleton class="h-5 w-36" />
			</div>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class={cn(ODD_LAST_TWO_COL_GRID_UNTIL_MD, 'grid grid-cols-2 gap-3 md:grid-cols-3')}>
				{#each Array.from({ length: 9 }) as _, index (index)}
					<div class="rounded-lg border bg-background p-3">
						<Skeleton class="mb-1 h-3.5 w-24 max-w-full" />
						<Skeleton class="h-5 w-28 max-w-full" />
					</div>
				{/each}
			</div>

			<div class="space-y-2">
				<div class="flex items-center gap-1.5">
					<Skeleton class="h-4 w-4 rounded-sm" />
					<Skeleton class="h-4 w-32" />
				</div>
				<div class="space-y-1.5">
					{#each Array.from({ length: scheduleRows }) as _, index (index)}
						<div class="flex items-start justify-between gap-3 rounded border bg-background p-3">
							<div class="flex min-w-0 items-center gap-2">
								<Skeleton class="h-4 w-7" />
								<Skeleton class="h-4 w-24" />
							</div>
							<div class="min-w-0 space-y-1.5 text-right">
								<Skeleton class="ml-auto h-5 w-28" />
								<Skeleton class="ml-auto h-3 w-40 max-w-full" />
							</div>
						</div>
					{/each}
				</div>
			</div>
		</Card.Content>
	</Card.Root>
{/snippet}

{#if variant === 'modal'}
	<div class="space-y-4" aria-busy="true" aria-label="Loading bank loan details" role="status">
		{@render summaryCells()}
		{@render interestOverview()}
	</div>
{:else}
	<div
		class="dashboard-form max-w-4xl"
		aria-busy="true"
		aria-label="Loading bank loan details"
		role="status"
	>
		<DetailHeaderSkeleton />
		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Skeleton class="h-5 w-40" />
				</Card.Header>
				<Card.Content>
					{@render summaryCells()}
				</Card.Content>
			</Card.Root>
			{@render interestOverview()}
		</div>
	</div>
{/if}
