<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import SkeletonMetricCell from './SkeletonMetricCell.svelte';

	interface Props {
		variant?: 'page' | 'modal';
	}

	let { variant = 'page' }: Props = $props();
</script>

<div aria-busy="true" aria-label="Loading loan details" class="dashboard-stack" role="status">
	{#if variant === 'page'}
		<DetailHeaderSkeleton />
	{/if}

	<Card.Root>
		<Card.Header>
			<Skeleton class="h-5 w-20" />
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4">
				{#each Array.from({ length: 10 }) as _, index (index)}
					<SkeletonMetricCell
						labelWidth={index === 6 || index === 7 ? 'w-14' : 'w-24'}
						valueWidth={index === 8 ? 'w-16' : 'w-28'}
						badge={index === 9}
					/>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Skeleton class="h-5 w-32" />
		</Card.Header>
		<Card.Content class="space-y-3">
			<div class="grid gap-3 sm:grid-cols-2">
				{#each Array.from({ length: 8 }) as _, index (index)}
					<div class="space-y-1">
						<Skeleton class="h-3 w-20" />
						<Skeleton class={index === 7 ? 'h-4 w-4/5' : 'h-4 w-3/5'} />
					</div>
				{/each}
			</div>
			<div class="space-y-1">
				<Skeleton class="h-3 w-14" />
				<Skeleton class="h-4 w-full max-w-2xl" />
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Skeleton class="h-5 w-24" />
		</Card.Header>
		<Card.Content class="space-y-3">
			{#each Array.from({ length: 2 }) as _, index (index)}
				<div class="overflow-hidden rounded-lg border border-border/80">
					<div class="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/50 px-3 py-2.5">
						<div class="min-w-0 space-y-1.5">
							<Skeleton class="h-4 w-32 max-w-full" />
							<Skeleton class="h-3 w-40 max-w-full" />
						</div>
						<Skeleton class="h-5 w-16 shrink-0 rounded-full" />
					</div>
					<div class="space-y-3 bg-muted/20 p-3">
						<div class="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5">
							<Skeleton class="h-4 w-24" />
							<Skeleton class="h-4 w-16" />
						</div>
						<div class="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5">
							<Skeleton class="h-4 w-20" />
							<Skeleton class="h-4 w-16" />
						</div>
					</div>
				</div>
			{/each}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0">
			<Skeleton class="h-5 w-24" />
			<Skeleton class="h-9 w-28 rounded-xl" />
		</Card.Header>
		<Card.Content class="space-y-3">
			{#each Array.from({ length: 2 }) as _, index (index)}
				<div class="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
					<Skeleton class="h-4 w-40 max-w-full" />
					<Skeleton class="h-8 w-8 rounded-lg" />
				</div>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
