<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		size?: 'sm' | 'md';
		class?: string;
	}

	let { size = 'md', class: className }: Props = $props();
</script>

<div class={cn('flex min-w-0 items-center gap-3', className)}>
	<Skeleton class={cn('shrink-0 rounded-full', size === 'sm' ? 'h-8 w-8' : 'h-9 w-9')} />
	<div class="min-w-0 flex-1 space-y-1.5">
		<Skeleton class="h-4 w-4/5 max-w-[10rem]" />
		<Skeleton class="h-3 w-1/2 max-w-[6rem]" />
	</div>
</div>
