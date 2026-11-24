<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';
	import SkeletonField from './page-skeletons/SkeletonField.svelte';

	interface Props {
		/** Hide the page title + save skeleton when the parent already renders a modal header. */
		showHeader?: boolean;
		/** Number of form cards to mirror. */
		sections?: number;
		showActions?: boolean;
		class?: string;
	}

	let {
		showHeader = true,
		sections = 1,
		showActions = true,
		class: className
	}: Props = $props();
</script>

<div aria-busy="true" aria-label="Loading form" class={cn('space-y-4', className)} role="status">
	{#if showHeader}
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<Skeleton class="h-7 w-40 md:h-8" />
			<Skeleton class="h-11 w-24 rounded-2xl" />
		</div>
	{/if}

	{#each Array.from({ length: sections }) as _, sectionIndex (sectionIndex)}
		<Card.Root class="border-border/60">
			{#if sectionIndex > 0}
				<Card.Header class="pb-2">
					<Skeleton class="h-5 w-32" />
				</Card.Header>
			{/if}
			<Card.Content class="space-y-4 p-3 md:p-4">
				<div class="grid gap-3 sm:grid-cols-2">
					{#each Array.from({ length: sectionIndex === 0 ? 6 : 4 }) as _, i (i)}
						<SkeletonField control labelWidth="w-24" valueWidth="w-full" />
					{/each}
				</div>
				{#if sectionIndex === 0}
					<SkeletonField tall labelWidth="w-16" valueWidth="w-full" />
				{/if}
				{#if sectionIndex === sections - 1 && showActions}
					<div class="flex justify-end gap-2">
						<Skeleton class="h-11 w-24 rounded-2xl" />
						<Skeleton class="h-11 w-28 rounded-2xl" />
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/each}
</div>
