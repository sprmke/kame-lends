<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		footer?: Snippet;
	}

	let { children, footer }: Props = $props();
</script>

<div class="surface-card overflow-hidden">
	{@render children()}
	{#if footer}
		{@render footer()}
	{/if}
</div>
