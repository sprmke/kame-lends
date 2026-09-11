<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();
</script>

<div
	class={cn('h-11 min-h-11 w-full', className)}
	aria-busy="true"
	aria-hidden="true"
	role="presentation"
>
	<Skeleton class="h-full w-full rounded-2xl" />
</div>
