<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		visibleBelowLarge?: boolean;
		children: Snippet;
	}

	let { visibleBelowLarge = true, children }: Props = $props();
</script>

<div class={cn(!visibleBelowLarge && 'hidden 2xl:block')}>
	{@render children()}
</div>
