<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		labelWidth?: string;
		valueWidth?: string;
		/** Value renders as a badge/pill in the real cell. */
		badge?: boolean;
		class?: string;
	}

	let {
		labelWidth = 'w-20',
		valueWidth = 'w-24',
		badge = false,
		class: className
	}: Props = $props();
</script>

<div class={cn('dashboard-metric-cell', className)} aria-hidden="true">
	<Skeleton class={cn('mb-1 h-3', labelWidth)} />
	<Skeleton
		class={cn(badge ? 'h-5 rounded-full' : 'h-4', valueWidth, 'max-w-full')}
	/>
</div>
