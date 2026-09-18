<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		offline: boolean;
	}

	let { offline }: Props = $props();
</script>

{#if offline}
	<div
		class={cn(
			'fixed inset-x-0 z-[45] border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:text-amber-100',
			'bottom-[calc(4.75rem+var(--safe-area-bottom))] lg:bottom-0'
		)}
		role="status"
	>
		Offline. Showing saved data.
	</div>
{/if}
