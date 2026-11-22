<script lang="ts">
	import { cn } from '$lib/utils';
	import ListCardSkeleton, { type ListCardSkeletonVariant } from './ListCardSkeleton.svelte';

	interface Props {
		count?: number;
		variant?: ListCardSkeletonVariant;
		class?: string;
	}

	let {
		count = 9,
		variant = 'person',
		class: className = 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3'
	}: Props = $props();
</script>

<div class={cn(className)} aria-hidden="true">
	{#each Array.from({ length: count }) as _, index (index)}
		<ListCardSkeleton {variant} />
	{/each}
</div>
