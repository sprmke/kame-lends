<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { BORROWER_DETAIL_SUMMARY_GRID } from '$lib/summary-grid';
	import DetailHeaderSkeleton from './DetailHeaderSkeleton.svelte';
	import ContactInfoCardSkeleton from './ContactInfoCardSkeleton.svelte';
	import SkeletonMetricGrid from './SkeletonMetricGrid.svelte';

	interface Props {
		variant?: 'page' | 'modal';
	}

	let { variant = 'page' }: Props = $props();
</script>

<div
	aria-busy="true"
	aria-label="Loading borrower details"
	class={variant === 'page' ? 'dashboard-form max-w-3xl' : 'dashboard-stack'}
	role="status"
>
	{#if variant === 'page'}
		<DetailHeaderSkeleton />
	{/if}

	<Skeleton class="h-9 w-40 rounded-xl" />

	<ContactInfoCardSkeleton />

	<SkeletonMetricGrid count={6} gridClass={BORROWER_DETAIL_SUMMARY_GRID} sub />

	<div class="space-y-3">
		<Skeleton class="h-4 w-24" />
		{#each Array.from({ length: 2 }) as _, index (index)}
			<Card.Root>
				<Card.Content class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="min-w-0 space-y-1.5">
						<Skeleton class="h-4 w-48 max-w-full" />
						<Skeleton class="h-3 w-28 max-w-full" />
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<Skeleton class="h-5 w-16 rounded-full" />
						<Skeleton class="h-5 w-20 rounded-full" />
						<Skeleton class="h-9 w-16 rounded-2xl" />
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
