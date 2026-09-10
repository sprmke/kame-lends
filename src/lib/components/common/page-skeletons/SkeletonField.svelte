<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		control?: boolean;
		tall?: boolean;
		labelWidth?: string;
		valueWidth?: string;
		class?: string;
	}

	let {
		control = false,
		tall = false,
		labelWidth = 'w-16',
		valueWidth = 'w-full max-w-xs',
		class: className
	}: Props = $props();
</script>

<div class={cn('space-y-2', className)}>
	<Skeleton class={cn('h-3', labelWidth)} />
	<Skeleton
		class={cn(
			tall ? 'h-20 rounded-md' : control ? 'h-11 rounded-2xl' : 'h-4',
			valueWidth
		)}
	/>
</div>
