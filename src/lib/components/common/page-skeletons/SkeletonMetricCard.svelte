<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
		/** Match cards that show a second line under the value. */
		sub?: boolean;
	}

	let { class: className, sub = false }: Props = $props();
</script>

<Card.Root class={cn('min-w-0 surface-card-interactive border-border/60', className)}>
	<Card.Content
		class={cn(
			'flex h-full w-full min-w-0 flex-col gap-1 p-3 md:p-5',
			sub && 'min-h-28 md:min-h-[7.5rem]'
		)}
	>
		<div class="flex items-center justify-between gap-2">
			<Skeleton class="h-3 w-24 max-w-[60%]" />
			<Skeleton class="icon-well-sm" />
		</div>
		<Skeleton class="mt-1 h-6 w-32 max-w-full" />
		{#if sub}
			<Skeleton class="mt-1 h-4 w-20 max-w-full" />
		{/if}
	</Card.Content>
</Card.Root>
