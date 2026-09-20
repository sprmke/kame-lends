<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		visible?: boolean;
		children: Snippet;
	}

	let { visible = true, children }: Props = $props();
</script>

{#if visible}
	<div class="h-full min-w-0">
		{@render children()}
	</div>
{/if}
