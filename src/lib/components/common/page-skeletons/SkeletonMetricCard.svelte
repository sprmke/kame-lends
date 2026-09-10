<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();
</script>

<Card.Root class={cn('min-w-0 surface-card-interactive border-border/60', className)}>
	<Card.Content class="flex h-full min-w-0 flex-col justify-between gap-1 p-3 md:min-h-[7.5rem] md:p-5">
		<div class="flex items-center justify-between gap-2">
			<Skeleton class="h-3 w-24" />
			<Skeleton class="icon-well-sm" />
		</div>
		<Skeleton class="mt-1 h-6 w-32 max-w-full" />
		<Skeleton class="mt-1 h-4 w-20" />
	</Card.Content>
</Card.Root>
